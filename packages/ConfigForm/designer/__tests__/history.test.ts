import type {
  DesignerDocument,
  DesignerMaterialDefinition,
  DesignerNode,
} from '../index'
import { describe, expect, it } from 'vitest'
import {
  applyDesignerCommand,
  createDesignerCopyCommand,
  createDesignerHistory,
  createDesignerRegistry,
  findDesignerNode,
  redoDesignerHistory,
  reduceDesignerCommand,
  resetDesignerHistory,
  undoDesignerHistory,
} from '../index'

const materials: DesignerMaterialDefinition[] = [
  {
    key: 'element.input',
    version: 1,
    kind: 'field',
    title: 'Input',
    category: 'Fields',
    runtime: { component: 'input' },
    setters: [],
    createNode: ({ id, field = 'field' }) => ({
      id,
      kind: 'field',
      material: 'element.input',
      field,
    }),
  },
  {
    key: 'element.section',
    version: 1,
    kind: 'container',
    title: 'Section',
    category: 'Layout',
    runtime: { component: 'section' },
    setters: [],
    slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.section',
      slots: { default: [] },
    }),
  },
]

const registry = createDesignerRegistry([{ name: 'adapter', materials }])

function createDocument(): DesignerDocument {
  return {
    version: 1,
    form: {},
    nodes: [
      {
        id: 'first',
        kind: 'field',
        material: 'element.input',
        field: 'first',
        props: { alpha: 1, beta: 2 },
      },
      {
        id: 'last',
        kind: 'field',
        material: 'element.input',
        field: 'last',
      },
      {
        id: 'section',
        kind: 'container',
        material: 'element.section',
        slots: {
          default: [
            {
              id: 'email',
              kind: 'field',
              material: 'element.input',
              field: 'email',
            },
            {
              id: 'nested',
              kind: 'container',
              material: 'element.section',
              slots: { default: [] },
            },
          ],
        },
      },
    ],
  }
}

function nodeIds(nodes: DesignerNode[]): string[] {
  return nodes.map(node => node.id)
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null)
    return value
  Object.freeze(value)
  for (const child of Object.values(value))
    deepFreeze(child)
  return value
}

describe('designer reducer', () => {
  it('adds nodes at root and nested targets without mutating frozen input', () => {
    const document = deepFreeze(createDocument())
    const snapshot = structuredClone(document)
    const rootResult = reduceDesignerCommand(document, {
      type: 'addNode',
      node: {
        id: 'age',
        kind: 'field',
        material: 'element.input',
        field: 'age',
      },
      target: { parentId: null, index: 1 },
    }, registry)

    expect(rootResult.changed).toBe(true)
    expect(nodeIds(rootResult.document.nodes)).toEqual(['first', 'age', 'last', 'section'])
    expect(document).toEqual(snapshot)

    const nestedResult = reduceDesignerCommand(rootResult.document, {
      type: 'addNode',
      node: {
        id: 'phone',
        kind: 'field',
        material: 'element.input',
        field: 'phone',
      },
      target: { parentId: 'section', slot: 'default', index: 1 },
    }, registry)

    expect(nestedResult.changed).toBe(true)
    const section = findDesignerNode(nestedResult.document, 'section')?.node
    expect(section?.kind === 'container' ? nodeIds(section.slots.default ?? []) : []).toEqual([
      'email',
      'phone',
      'nested',
    ])
  })

  it('moves nodes within a list and across containers using final insertion indexes', () => {
    const document = createDocument()
    const sameList = reduceDesignerCommand(document, {
      type: 'moveNode',
      nodeId: 'first',
      target: { parentId: null, index: 1 },
    }, registry)

    expect(sameList.changed).toBe(true)
    expect(nodeIds(sameList.document.nodes)).toEqual(['last', 'first', 'section'])

    const crossContainer = reduceDesignerCommand(document, {
      type: 'moveNode',
      nodeId: 'last',
      target: { parentId: 'nested', slot: 'default', index: 0 },
    }, registry)

    expect(crossContainer.changed).toBe(true)
    expect(nodeIds(crossContainer.document.nodes)).toEqual(['first', 'section'])
    const nested = findDesignerNode(crossContainer.document, 'nested')?.node
    expect(nested?.kind === 'container' ? nodeIds(nested.slots.default ?? []) : []).toEqual(['last'])
  })

  it('rejects unknown parents, invalid slots, invalid indexes, and cycle moves', () => {
    const document = createDocument()
    const commands = [
      {
        command: {
          type: 'moveNode' as const,
          nodeId: 'first',
          target: { parentId: 'missing', slot: 'default' },
        },
        code: 'DESIGNER_COMMAND_PARENT_UNKNOWN',
      },
      {
        command: {
          type: 'moveNode' as const,
          nodeId: 'first',
          target: { parentId: 'section', slot: 'missing' },
        },
        code: 'DESIGNER_COMMAND_SLOT_INVALID',
      },
      {
        command: {
          type: 'moveNode' as const,
          nodeId: 'first',
          target: { parentId: null, index: 99 },
        },
        code: 'DESIGNER_COMMAND_INDEX_INVALID',
      },
      {
        command: {
          type: 'moveNode' as const,
          nodeId: 'section',
          target: { parentId: 'nested', slot: 'default' },
        },
        code: 'DESIGNER_COMMAND_MOVE_CYCLE',
      },
    ]

    for (const { command, code } of commands) {
      const result = reduceDesignerCommand(document, command, registry)
      expect(result.changed).toBe(false)
      expect(result.document).toBe(document)
      expect(result.diagnostics).toEqual([expect.objectContaining({ code })])
    }
  })

  it('copies complete subtrees with regenerated ids and field keys', () => {
    const document = createDocument()
    const snapshot = structuredClone(document)
    const command = createDesignerCopyCommand(document, 'section', { parentId: null }, {
      createId: sourceId => `${sourceId}-copy`,
      createField: sourceField => `${sourceField}-copy`,
    })
    const result = reduceDesignerCommand(document, command, registry)

    expect(result.changed).toBe(true)
    expect(document).toEqual(snapshot)
    expect(nodeIds(result.document.nodes)).toEqual(['first', 'last', 'section', 'section-copy'])
    const copiedSection = findDesignerNode(result.document, 'section-copy')?.node
    expect(copiedSection?.kind).toBe('container')
    if (copiedSection?.kind !== 'container')
      return
    expect(nodeIds(copiedSection.slots.default ?? [])).toEqual(['email-copy', 'nested-copy'])
    expect(findDesignerNode(result.document, 'email-copy')?.node).toMatchObject({ field: 'email-copy' })

    const incomplete = reduceDesignerCommand(document, {
      type: 'copyNode',
      nodeId: 'section',
      target: { parentId: null },
      newIds: { section: 'section-copy' },
      newFields: {},
    }, registry)
    expect(incomplete).toMatchObject({
      changed: false,
      diagnostics: [{ code: 'DESIGNER_COMMAND_COPY_MAPPING_INCOMPLETE' }],
    })
  })

  it('rejects duplicate identity changes and safely parses replacement input', () => {
    const document = deepFreeze(createDocument())
    const duplicateId = reduceDesignerCommand(document, {
      type: 'addNode',
      node: {
        id: 'first',
        kind: 'field',
        material: 'element.input',
        field: 'unique',
      },
      target: { parentId: null },
    }, registry)
    expect(duplicateId).toMatchObject({
      changed: false,
      diagnostics: [{ code: 'DESIGNER_NODE_ID_DUPLICATE' }],
    })
    expect(duplicateId.document).toBe(document)

    const duplicateField = reduceDesignerCommand(document, {
      type: 'updateNode',
      nodeId: 'last',
      changes: { field: 'first' },
    }, registry)
    expect(duplicateField).toMatchObject({
      changed: false,
      diagnostics: [{ code: 'DESIGNER_FIELD_DUPLICATE' }],
    })
    expect(duplicateField.document).toBe(document)

    const cyclic: Record<string, unknown> = { version: 1, form: {}, nodes: [] }
    cyclic.self = cyclic
    const replacement = reduceDesignerCommand(document, {
      type: 'replaceDocument',
      document: cyclic,
    }, registry)
    expect(replacement).toMatchObject({
      changed: false,
      diagnostics: [{ code: 'DESIGNER_DOCUMENT_CYCLE' }],
    })
    expect(replacement.document).toBe(document)
  })

  it('updates, clears, and removes node properties through parsed candidates', () => {
    const document = createDocument()
    const updated = reduceDesignerCommand(document, {
      type: 'updateNode',
      nodeId: 'first',
      changes: { label: 'First name', span: 2 },
    }, registry)
    expect(updated.changed).toBe(true)
    expect(findDesignerNode(updated.document, 'first')?.node).toMatchObject({
      label: 'First name',
      span: 2,
    })

    const cleared = reduceDesignerCommand(updated.document, {
      type: 'updateNode',
      nodeId: 'first',
      changes: { label: undefined },
    }, registry)
    expect(cleared.changed).toBe(true)
    expect(findDesignerNode(cleared.document, 'first')?.node).not.toHaveProperty('label')

    const immutable = reduceDesignerCommand(document, {
      type: 'updateNode',
      nodeId: 'first',
      changes: { id: 'other' } as never,
    }, registry)
    expect(immutable).toMatchObject({
      changed: false,
      diagnostics: [{ code: 'DESIGNER_COMMAND_PROPERTY_IMMUTABLE' }],
    })

    const removed = reduceDesignerCommand(cleared.document, {
      type: 'removeNode',
      nodeId: 'last',
    }, registry)
    expect(removed.changed).toBe(true)
    expect(findDesignerNode(removed.document, 'last')).toBeUndefined()
  })

  it('updates nested setter paths and form settings through dedicated commands', () => {
    const document = createDocument()
    const nested = reduceDesignerCommand(document, {
      type: 'updateNodePath',
      nodeId: 'first',
      path: ['props', 'placeholder'],
      value: 'Enter a name',
    }, registry)
    expect(nested.changed).toBe(true)
    expect(findDesignerNode(nested.document, 'first')?.node).toMatchObject({
      props: { alpha: 1, beta: 2, placeholder: 'Enter a name' },
    })

    const cleared = reduceDesignerCommand(nested.document, {
      type: 'updateNodePath',
      nodeId: 'first',
      path: ['props', 'placeholder'],
      value: undefined,
    }, registry)
    expect(cleared.changed).toBe(true)
    expect(findDesignerNode(cleared.document, 'first')?.node).toMatchObject({
      props: { alpha: 1, beta: 2 },
    })

    const unsafe = reduceDesignerCommand(document, {
      type: 'updateNodePath',
      nodeId: 'first',
      path: ['props', '__proto__', 'polluted'],
      value: true,
    }, registry)
    expect(unsafe).toMatchObject({
      changed: false,
      diagnostics: [{ code: 'DESIGNER_COMMAND_PATH_UNSAFE' }],
    })

    const form = reduceDesignerCommand(document, {
      type: 'updateForm',
      changes: { columns: 3, gap: '12px' },
    }, registry)
    expect(form).toMatchObject({
      changed: true,
      document: { form: { columns: 3, gap: '12px' } },
    })
  })
})

describe('designer history', () => {
  it('records only changed commands and supports undo, redo, and branching', () => {
    const initial = createDesignerHistory(createDocument())
    const failed = applyDesignerCommand(initial, {
      type: 'removeNode',
      nodeId: 'missing',
    }, registry)
    expect(failed.history).toBe(initial)

    const noOp = applyDesignerCommand(initial, {
      type: 'updateNode',
      nodeId: 'first',
      changes: { props: { beta: 2, alpha: 1 } },
    }, registry)
    expect(noOp.changed).toBe(false)
    expect(noOp.history).toBe(initial)

    const changed = applyDesignerCommand(initial, {
      type: 'updateNode',
      nodeId: 'first',
      changes: { label: 'One' },
    }, registry)
    expect(changed.history.past).toHaveLength(1)
    expect(changed.history.future).toEqual([])

    const undone = undoDesignerHistory(changed.history)
    expect(findDesignerNode(undone.history.present, 'first')?.node).not.toHaveProperty('label')
    expect(undone.history.future).toHaveLength(1)

    const redone = redoDesignerHistory(undone.history)
    expect(findDesignerNode(redone.history.present, 'first')?.node).toMatchObject({ label: 'One' })

    const branched = applyDesignerCommand(undone.history, {
      type: 'updateNode',
      nodeId: 'first',
      changes: { label: 'Branch' },
    }, registry)
    expect(branched.history.future).toEqual([])
    expect(redoDesignerHistory(branched.history).changed).toBe(false)
  })

  it('preserves extension metadata through path updates, undo, and redo', () => {
    const initial = createDesignerHistory(createDocument())
    const changed = applyDesignerCommand(initial, {
      type: 'updateNodePath',
      nodeId: 'first',
      path: ['extensions', 'designer.setter'],
      value: { path: ['label'], source: 'local' },
    }, registry)

    expect(findDesignerNode(changed.history.present, 'first')?.node).toMatchObject({
      extensions: { 'designer.setter': { path: ['label'], source: 'local' } },
    })
    const undone = undoDesignerHistory(changed.history)
    expect(findDesignerNode(undone.history.present, 'first')?.node).not.toHaveProperty('extensions')
    const redone = redoDesignerHistory(undone.history)
    expect(findDesignerNode(redone.history.present, 'first')?.node).toMatchObject({
      extensions: { 'designer.setter': { path: ['label'], source: 'local' } },
    })
  })

  it('bounds snapshots and resets external document replacements as a new baseline', () => {
    let history = createDesignerHistory(createDocument(), 2)
    for (const label of ['One', 'Two', 'Three']) {
      history = applyDesignerCommand(history, {
        type: 'updateNode',
        nodeId: 'first',
        changes: { label },
      }, registry).history
    }
    expect(history.past).toHaveLength(2)

    history = undoDesignerHistory(history).history
    expect(findDesignerNode(history.present, 'first')?.node).toMatchObject({ label: 'Two' })
    history = undoDesignerHistory(history).history
    expect(findDesignerNode(history.present, 'first')?.node).toMatchObject({ label: 'One' })
    expect(undoDesignerHistory(history).changed).toBe(false)

    const external = createDocument()
    external.form.columns = 4
    const reset = resetDesignerHistory(history, external)
    expect(reset.past).toEqual([])
    expect(reset.future).toEqual([])
    expect(reset.present).toEqual(external)
    expect(reset.present).not.toBe(external)
    expect(reset.limit).toBe(2)
  })
})
