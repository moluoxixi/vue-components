import type { ProjectDocument } from '../index'
import { describe, expect, it } from 'vitest'
import {
  applyProjectTransaction,
  deriveProjectPageValueSchema,
  PAGE_GRAPH_VERSION,
  parseProjectDocument,
  PROJECT_DOCUMENT_VERSION,
  resolveProjectCommand,
} from '../index'

function documentFixture(): ProjectDocument {
  return {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'runtime-project',
    name: 'Runtime project',
    homePageId: 'home',
    pageOrder: ['home'],
    pagesById: {
      home: {
        id: 'home',
        name: 'Home',
        route: '/',
        runtime: {
          variables: [{
            id: 'locale',
            name: 'Locale',
            initialValue: 'en-US',
          }],
          dataSources: [{
            id: 'countries',
            name: 'Countries',
            request: {
              url: '/api/countries',
              query: { locale: { $ref: { kind: 'variable', variableId: 'locale' } } },
            },
            mapping: { $ref: { kind: 'event', path: ['data'] } },
          }],
        },
        graph: {
          version: PAGE_GRAPH_VERSION,
          props: {},
          form: {},
          root: [
            { nodeId: 'customer', placement: {} },
            { nodeId: 'shipping', placement: {} },
            { nodeId: 'global', placement: {} },
          ],
          nodesById: {
            'customer': {
              id: 'customer',
              component: 'layout.object',
              kind: 'layout',
              valueScope: { kind: 'object', field: 'customer' },
              props: {},
              bindings: {},
              slots: {
                default: [
                  { nodeId: 'customer-name', placement: {} },
                  { nodeId: 'customer-display', placement: {} },
                ],
              },
            },
            'customer-name': {
              id: 'customer-name',
              component: 'input',
              kind: 'field',
              field: 'name',
              defaultValue: 'Ada',
              optionSource: {
                kind: 'dataSource',
                dataSourceId: 'countries',
                params: { locale: { $ref: { kind: 'variable', variableId: 'locale' } } },
              },
              props: {},
              bindings: {},
            },
            'customer-display': {
              id: 'customer-display',
              component: 'input',
              kind: 'field',
              field: 'display',
              validation: {
                version: 1,
                base: { type: 'string' },
                rules: [{ kind: 'compare', field: 'name', operator: 'eq' }],
              },
              conditions: {
                visible: {
                  kind: 'compare',
                  operator: 'eq',
                  left: { kind: 'field', field: 'name' },
                  right: { kind: 'literal', value: 'Ada' },
                },
              },
              props: {},
              bindings: {},
            },
            'shipping': {
              id: 'shipping',
              component: 'layout.object',
              kind: 'layout',
              valueScope: { kind: 'object', field: 'shipping' },
              props: {},
              bindings: {},
              slots: { default: [{ nodeId: 'shipping-name', placement: {} }] },
            },
            'shipping-name': {
              id: 'shipping-name',
              component: 'input',
              kind: 'field',
              field: 'name',
              props: {},
              bindings: {},
            },
            'global': {
              id: 'global',
              component: 'input',
              kind: 'field',
              field: 'global',
              props: {},
              bindings: {},
            },
          },
        },
      },
    },
    registryLock: { adapter: 'test', version: '1', fingerprint: 'test', components: {} },
    settings: {},
    resources: {},
  }
}

function applyPatch(document: ProjectDocument, nodeId: string, set: Record<string, unknown>) {
  const resolution = resolveProjectCommand(document, {
    id: `patch-${nodeId}`,
    label: `Patch ${nodeId}`,
    actions: [{ type: 'node.patch', pageId: 'home', nodeId, patch: { set } }],
  })
  if (!resolution.success)
    return resolution
  return applyProjectTransaction(document, resolution.transaction)
}

describe('data runtime model contract', () => {
  it('round-trips runtime declarations and derives nested value scopes from containment', () => {
    const input = documentFixture()
    const result = parseProjectDocument(JSON.parse(JSON.stringify(input)))

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.data).toEqual(input)
    expect(deriveProjectPageValueSchema(result.data.pagesById.home!.graph)).toEqual({
      valueScopes: [
        { nodeId: 'customer', field: 'customer', kind: 'object' },
        { nodeId: 'shipping', field: 'shipping', kind: 'object' },
      ],
      scopedFields: [
        { nodeId: 'customer-name', field: 'name', scopeId: 'customer', defaultValue: 'Ada' },
        { nodeId: 'customer-display', field: 'display', scopeId: 'customer' },
        { nodeId: 'shipping-name', field: 'name', scopeId: 'shipping' },
        { nodeId: 'global', field: 'global' },
      ],
    })
  })

  it('rejects removed Flow output value references at the document boundary', () => {
    const direct = structuredClone(documentFixture())
    ;(direct.pagesById.home!.runtime!.variables[0] as { initialValue: unknown }).initialValue = {
      $ref: { kind: 'output', stepId: 'load' },
    }
    expect(parseProjectDocument(direct).success).toBe(false)

    const expression = structuredClone(documentFixture())
    ;(expression.pagesById.home!.runtime!.variables[0] as { initialValue: unknown }).initialValue = {
      $ref: { kind: 'expression', source: '$outputs["load"]' },
    }
    expect(parseProjectDocument(expression).success).toBe(false)
  })

  it('updates page runtime atomically and restores the exact optional block with undo', () => {
    const input = documentFixture()
    const runtime = structuredClone(input.pagesById.home!.runtime!)
    runtime.variables[0]!.initialValue = 'fr-FR'
    const changed = applyProjectTransaction(input, {
      id: 'runtime-update',
      label: 'Update runtime',
      operations: [{ type: 'page.runtime', pageId: 'home', runtime }],
    })

    expect(changed.success).toBe(true)
    if (!changed.success)
      return
    expect(changed.document.pagesById.home!.runtime).toEqual(runtime)
    expect(input.pagesById.home!.runtime!.variables[0]!.initialValue).toBe('en-US')

    const undone = applyProjectTransaction(changed.document, changed.inverse)
    expect(undone.success).toBe(true)
    if (undone.success)
      expect(undone.document).toEqual(input)
  })

  it('preserves valueScope and optionSource through semantic patches and inverse operations', () => {
    const input = documentFixture()
    const field = applyPatch(input, 'customer-name', { label: 'Customer name' })
    expect(field.success).toBe(true)
    if (!field.success)
      return
    expect(field.document.pagesById.home!.graph.nodesById['customer-name']).toMatchObject({
      label: 'Customer name',
      optionSource: input.pagesById.home!.graph.nodesById['customer-name']!.kind === 'field'
        ? input.pagesById.home!.graph.nodesById['customer-name']!.optionSource
        : undefined,
    })

    const layout = applyPatch(field.document, 'customer', { valueScope: { kind: 'object', field: 'profile' } })
    expect(layout.success).toBe(true)
    if (!layout.success)
      return
    expect(layout.document.pagesById.home!.graph.nodesById.customer).toMatchObject({
      valueScope: { kind: 'object', field: 'profile' },
    })
    const restoredLayout = applyProjectTransaction(layout.document, layout.inverse)
    expect(restoredLayout.success).toBe(true)
    if (restoredLayout.success)
      expect(restoredLayout.document).toEqual(field.document)
  })

  it('allows equal field names in separate scopes but rejects same-scope insert and move atomically', () => {
    const input = documentFixture()
    expect(parseProjectDocument(input).success).toBe(true)

    const inserted = applyProjectTransaction(input, {
      id: 'duplicate-in-scope',
      label: 'Insert duplicate in scope',
      operations: [{
        type: 'node.insert',
        pageId: 'home',
        target: { parentId: 'customer', slot: 'default' },
        subgraph: {
          root: [{ nodeId: 'duplicate-name', placement: {} }],
          nodesById: {
            'duplicate-name': {
              id: 'duplicate-name',
              component: 'input',
              kind: 'field',
              field: 'name',
              props: {},
              bindings: {},
            },
          },
        },
      }],
    })
    expect(inserted).toMatchObject({
      success: false,
      document: input,
      diagnostics: [{ code: 'PROJECT_FIELD_DUPLICATE' }],
    })

    const moved = applyProjectTransaction(input, {
      id: 'move-between-scopes',
      label: 'Move between scopes',
      operations: [{
        type: 'node.move',
        pageId: 'home',
        nodeId: 'shipping-name',
        target: { parentId: 'customer', slot: 'default' },
      }],
    })
    expect(moved).toMatchObject({
      success: false,
      document: input,
      diagnostics: [{ code: 'PROJECT_FIELD_DUPLICATE' }],
    })
    expect(input.pagesById.home!.graph.nodesById).not.toHaveProperty('duplicate-name')
  })

  it('renames structured validation and condition field references', () => {
    const input = documentFixture()
    const result = applyPatch(input, 'customer-name', { field: 'fullName' })

    expect(result.success).toBe(true)
    if (!result.success)
      return
    const page = result.document.pagesById.home!
    const name = page.graph.nodesById['customer-name']
    const display = page.graph.nodesById['customer-display']
    expect(name).toMatchObject({ field: 'fullName' })
    expect(display).toMatchObject({
      validation: { rules: [{ field: 'fullName' }] },
      conditions: { visible: { left: { field: 'fullName' } } },
    })
  })

  it('remaps only internal duplicate references and refuses unsafe expression renames', () => {
    const input = documentFixture()
    const resolution = resolveProjectCommand(input, {
      id: 'duplicate-customer',
      label: 'Duplicate customer',
      actions: [{
        type: 'node.duplicate',
        pageId: 'home',
        nodeId: 'customer',
        target: { parentId: null },
        idMap: {
          'customer': 'customer-copy',
          'customer-name': 'customer-name-copy',
          'customer-display': 'customer-display-copy',
        },
        fieldMap: { customer: 'customerCopy', name: 'nameCopy', display: 'displayCopy' },
      }],
    })
    expect(resolution.success).toBe(true)
    if (!resolution.success)
      return
    const duplicated = applyProjectTransaction(input, resolution.transaction)
    expect(duplicated.success).toBe(true)
    if (!duplicated.success)
      return
    expect(duplicated.document.pagesById.home!.graph.nodesById['customer-display-copy']).toMatchObject({
      field: 'displayCopy',
      conditions: { visible: { left: { field: 'nameCopy' } } },
    })

    const expressionDocument = documentFixture()
    const display = expressionDocument.pagesById.home!.graph.nodesById['customer-display']!
    display.conditions = { visible: { kind: 'expression', expression: 'name == "Ada"' } }
    const refused = applyPatch(expressionDocument, 'customer-name', { field: 'fullName' })
    expect(refused).toMatchObject({
      success: false,
      diagnostics: [{ code: 'PROJECT_REFERENCE_REWRITE_UNSUPPORTED' }],
    })
    if ('document' in refused)
      expect(refused.document).toBe(expressionDocument)
  })

  it('refuses deletion of referenced fields and data sources without side effects', () => {
    const input = documentFixture()
    const field = applyProjectTransaction(input, {
      id: 'remove-referenced-field',
      label: 'Remove referenced field',
      operations: [{ type: 'node.remove', pageId: 'home', nodeId: 'customer-name' }],
    })
    expect(field.success).toBe(false)
    expect(field.document).toBe(input)

    const runtime = structuredClone(input.pagesById.home!.runtime!)
    runtime.dataSources = []
    const source = applyProjectTransaction(input, {
      id: 'remove-referenced-source',
      label: 'Remove referenced source',
      operations: [{ type: 'page.runtime', pageId: 'home', runtime }],
    })
    expect(source).toMatchObject({
      success: false,
      document: input,
      diagnostics: [expect.objectContaining({ message: expect.stringContaining('unknown data source') })],
    })
  })
})
