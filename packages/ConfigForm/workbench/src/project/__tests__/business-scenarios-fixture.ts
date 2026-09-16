import type { ConfigFormFlow, ConfigFormJsonValue } from '@moluoxixi/config-form-core'
import type { FieldNode, LayoutNode, PageGraph, ProjectDocument, ProjectPage } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter, WorkbenchAdapterId } from '../../adapters'
import type { CanonicalSourceBindingResolver } from '../export'
import type { WorkspaceFile } from '../types'
import type { BusinessScenario, BusinessScenariosFixture } from './types'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { assertProjectDocument, createProjectSnapshot, PROJECT_DOCUMENT_VERSION } from '@moluoxixi/config-form-model'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'
import { loadWorkbenchAdapter } from '../../adapters'
import { createCanonicalProjectConfigExport, createCanonicalProjectSourceExport } from '../export'
import { createGeneratedModuleLoader } from './generated-runtime-module'

export type { BusinessScenario, BusinessScenariosFixture } from './types'

export const BUSINESS_PROVIDERS = ['element-plus', 'antd-vue'] as const
export const BUSINESS_SCENARIOS = ['profile', 'order', 'submission'] as const
export const BUSINESS_ORIGIN = 'https://business-scenarios.invalid'

function valueEvent(prefix: string): string {
  return prefix === 'element' ? 'update:modelValue' : 'update:value'
}
function fieldRef(nodeId: string): ConfigFormJsonValue {
  return { $ref: { kind: 'field', nodeId } }
}
function outputRef(stepId: string, ...path: string[]): ConfigFormJsonValue {
  return { $ref: { kind: 'output', stepId, path } }
}
function action(id: string, ref: string, input: ConfigFormJsonValue): ConfigFormFlow['nodes'][number] {
  return { id, type: 'action', ref, config: { input } }
}
function edge(source: string, target: string, condition: ConfigFormFlow['edges'][number]['condition'] = 'next'): ConfigFormFlow['edges'][number] {
  return { id: `${source}-${condition}-${target}`, source, target, condition }
}
function sequence(id: string, trigger: ConfigFormFlow['trigger'], actions: ConfigFormFlow['nodes']): ConfigFormFlow {
  const nodes: ConfigFormFlow['nodes'] = [{ id: 'start', type: 'trigger' }, ...actions, { id: 'end', type: 'success' }]
  return { version: 1, id, name: id, trigger, nodes, edges: nodes.slice(1).map((node, index) => edge(nodes[index]!.id, node.id)) }
}

function materialGraph(adapter: WorkbenchAdapter, prefix: string) {
  const graph: PageGraph = { version: 2, props: {}, form: { labelPosition: 'top' }, root: [], nodesById: {} }
  function add(material: string, id: string, field: string, parent?: string) {
    const subgraph = adapter.designerRegistry.createSubgraph(`${prefix}.${material}`, { id, field })
    Object.assign(graph.nodesById, subgraph.nodesById)
    if (parent) {
      const owner = graph.nodesById[parent]
      if (owner?.kind !== 'layout' || !owner.slots.default)
        throw new Error(`Missing material slot: ${parent}.default`)
      owner.slots.default.push(...subgraph.root)
    }
    else {
      graph.root.push(...subgraph.root)
    }
    const node = graph.nodesById[id]
    if (!node)
      throw new Error(`Material did not create node: ${id}`)
    return node
  }
  return {
    graph,
    field(material: string, id: string, field: string, defaults: Partial<FieldNode> = {}, parent?: string): FieldNode {
      const node = add(material, id, field, parent)
      if (node.kind !== 'field')
        throw new Error(`Expected field material: ${material}`)
      Object.assign(node, defaults)
      return node
    },
    layout(material: string, id: string, field: string, valueScope: LayoutNode['valueScope'], parent?: string): LayoutNode {
      const node = add(material, id, field, parent)
      if (node.kind !== 'layout')
        throw new Error(`Expected layout material: ${material}`)
      node.valueScope = valueScope
      node.props.title = id
      return node
    },
  }
}

function profilePage(adapter: WorkbenchAdapter, prefix: string): ProjectPage {
  const { graph, field } = materialGraph(adapter, prefix)
  field('input', 'name', 'name', {
    label: 'Name',
    validateOn: ['blur'],
    validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'required', message: 'Name required' }] },
  })
  field('input', 'country', 'country', { label: 'Country', defaultValue: 'US' })
  field('select', 'city', 'city', {
    label: 'City',
    optionSource: { kind: 'dataSource', dataSourceId: 'cities' },
    validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'required', message: 'City required' }] },
  })
  field('input', 'membership', 'membership', { label: 'Membership', defaultValue: 'personal' })
  const business = { kind: 'compare', operator: 'eq', left: { kind: 'field', field: 'membership' }, right: { kind: 'literal', value: 'business' } } as const
  field('input', 'company', 'company', {
    label: 'Company',
    defaultValue: '',
    validateOn: ['blur'],
    conditions: { required: business, visible: business },
  })
  return {
    id: 'profile',
    name: 'Profile',
    route: '/profile',
    graph,
    runtime: {
      variables: [
        { id: 'endpoint', name: 'City endpoint', initialValue: { $ref: { kind: 'expression', source: 'CONCAT($variables["base"], "/cities")' } } },
        { id: 'tenant', name: 'Tenant', initialValue: { $ref: { kind: 'expression', source: 'CONCAT($variables["locale"], "-tenant")' } } },
        { id: 'locale', name: 'Locale', initialValue: 'en' },
        { id: 'base', name: 'Service base', initialValue: BUSINESS_ORIGIN },
      ],
      dataSources: [{
        id: 'cities',
        name: 'Cities by country',
        auto: true,
        cacheTtlMs: 60_000,
        request: {
          url: { $ref: { kind: 'variable', variableId: 'endpoint' } },
          method: 'GET',
          query: { country: fieldRef('country') },
          headers: { 'x-tenant': { $ref: { kind: 'variable', variableId: 'tenant' } } },
        },
        dependencies: [{ kind: 'field', nodeId: 'country' }],
        mapping: { $ref: { kind: 'event', path: ['data', 'cities'] } },
      }],
    },
    flows: [sequence('country-cascade', { kind: 'component.event', nodeId: 'country', event: valueEvent(prefix) }, [
      action('clear-city', 'builtin.field.set', { fieldId: 'city', value: '' }),
      action('refresh-cities', 'builtin.dataSource.load', { dataSourceId: 'cities' }),
    ])],
  }
}

export function declaredOrderValues() {
  return {
    shipping: 10,
    taxRate: 0.1,
    shippingTax: 1,
    buyer: { name: 'Default buyer' },
    orders: [{ title: 'New order', details: [{ sku: 'New item', quantity: 1, price: 5, total: 5, checked: 'pending' }] }],
  }
}
export function populatedOrderValues() {
  return {
    shipping: 10,
    taxRate: 0.1,
    shippingTax: 1,
    buyer: { name: 'Ada' },
    orders: [
      { title: 'First order', details: [{ sku: 'A', quantity: 2, price: 10, total: 20, checked: 'pending' }] },
      { title: 'Second order', details: [{ sku: 'B', quantity: 3, price: 7, total: 21, checked: 'pending' }] },
    ],
  }
}
function orderPage(adapter: WorkbenchAdapter, prefix: string, readonly: boolean): ProjectPage {
  const { graph, field, layout } = materialGraph(adapter, prefix)
  graph.form.readonly = readonly
  field('input-number', 'shipping', 'shipping', { defaultValue: 10 })
  field('input-number', 'tax-rate', 'taxRate', { defaultValue: 0.1 })
  field('input-number', 'shipping-tax', 'shippingTax', {
    defaultValue: 1,
    conditions: { readonly: { kind: 'literal', value: true } },
    reactions: [{ id: 'shipping-tax', when: { kind: 'literal', value: true }, then: [
      { kind: 'setValue', target: 'shippingTax', value: { kind: 'expression', expression: 'shipping * taxRate' } },
    ] }],
  })
  layout('object-group', 'buyer', 'buyer', { kind: 'object', field: 'buyer' })
  field('input', 'buyer-name', 'name', { label: 'Buyer', defaultValue: 'Default buyer' }, 'buyer')
  layout('detail-table', 'orders', 'orders', { kind: 'array', field: 'orders', minItems: 1, maxItems: 3 })
  field('input', 'order-title', 'title', { label: 'Order', defaultValue: 'New order' }, 'orders')
  layout('array-subform', 'details', 'details', { kind: 'array', field: 'details', minItems: 1, maxItems: 3 }, 'orders')
  field('input', 'sku', 'sku', {
    label: 'SKU',
    defaultValue: 'New item',
    validateOn: ['blur'],
    validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'required', message: 'SKU required' }] },
  }, 'details')
  field('input-number', 'quantity', 'quantity', { label: 'Quantity', defaultValue: 1 }, 'details')
  field('input-number', 'price', 'price', { label: 'Price', defaultValue: 5 }, 'details')
  field('input-number', 'total', 'total', { label: 'Total', defaultValue: 5, conditions: { readonly: { kind: 'literal', value: true } } }, 'details')
  field('input', 'checked', 'checked', { label: 'Checked total', defaultValue: 'pending' }, 'details')
  return {
    id: 'order',
    name: 'Order',
    route: '/order',
    graph,
    flows: [sequence('calculate-line', { kind: 'component.event', nodeId: 'quantity', event: valueEvent(prefix) }, [
      action('calculate', 'builtin.field.set', { fieldId: 'total', value: { $ref: { kind: 'expression', source: '$fields["quantity"] * $fields["price"]' } } }),
      action('check-total', 'builtin.field.set', { fieldId: 'checked', value: { $ref: { kind: 'expression', source: 'CONCAT("checked:", $fields["total"])' } } }),
    ])],
  }
}

function submissionPage(adapter: WorkbenchAdapter, prefix: string): ProjectPage {
  const { graph, field } = materialGraph(adapter, prefix)
  field('input', 'reference', 'reference', {
    label: 'Reference',
    defaultValue: 'INV-1',
    validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'required', message: 'Reference required' }] },
  })
  field('input', 'decision', 'decision', { label: 'Decision', defaultValue: 'allow' })
  return {
    id: 'submission',
    name: 'Submission',
    route: '/submission',
    graph,
    runtime: { variables: [{ id: 'receipt', name: 'Receipt', initialValue: '' }], dataSources: [] },
    flows: [
      {
        version: 1,
        id: 'confirm-submit',
        name: 'Confirm submit',
        trigger: { kind: 'form.beforeSubmit' },
        nodes: [
          { id: 'start', type: 'trigger' },
          action('confirm', 'builtin.ui.confirm', { message: 'Submit invoice?' }),
          { id: 'confirmed', type: 'condition', config: { condition: { kind: 'expression', expression: '$outputs["confirm"].confirmed == true' } } },
          { id: 'allowed', type: 'condition', config: { condition: { kind: 'expression', expression: '$fields["decision"] == "allow"' } } },
          { id: 'end', type: 'success' },
          { id: 'cancel', type: 'blocked' },
        ],
        edges: [edge('start', 'confirm'), edge('confirm', 'confirmed'), edge('confirmed', 'allowed', 'true'), edge('confirmed', 'cancel', 'false'), edge('allowed', 'end', 'true'), edge('allowed', 'cancel', 'false')],
      },
      {
        version: 1,
        id: 'send-invoice',
        name: 'Send invoice',
        trigger: { kind: 'form.submit' },
        concurrency: 'ignore',
        nodes: [
          { id: 'start', type: 'trigger' },
          action('request', 'builtin.http.request', { url: `${BUSINESS_ORIGIN}/submit`, method: 'POST', body: { reference: fieldRef('reference') } }),
          { id: 'accepted', type: 'condition', config: { condition: { kind: 'expression', expression: '$outputs["request"].data.accepted == true' } } },
          action('audit', 'host.businessAudit', { outcome: 'accepted', receipt: outputRef('request', 'data', 'receipt') }),
          action('receipt', 'builtin.variable.set', { variableId: 'receipt', value: outputRef('audit', 'receipt') }),
          action('declined', 'host.businessAudit', { outcome: 'declined' }),
          action('failed', 'host.businessAudit', { outcome: 'transport-error' }),
          { id: 'end', type: 'success' },
          { id: 'block', type: 'blocked' },
        ],
        edges: [
          edge('start', 'request'),
          edge('request', 'accepted'),
          edge('request', 'failed', 'error'),
          edge('accepted', 'audit', 'true'),
          edge('accepted', 'declined', 'false'),
          edge('audit', 'receipt'),
          edge('receipt', 'end'),
          edge('declined', 'block'),
          edge('failed', 'block'),
        ],
      },
    ],
  }
}

export async function createBusinessScenariosFixture(
  provider: WorkbenchAdapterId,
  options: { readonlyOrder?: boolean } = {},
): Promise<BusinessScenariosFixture> {
  const adapter = await loadWorkbenchAdapter(provider)
  const prefix = provider === 'element-plus' ? 'element' : 'antd'
  const pages = [profilePage(adapter, prefix), orderPage(adapter, prefix, options.readonlyOrder ?? false), submissionPage(adapter, prefix)]
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: `business-${provider}`,
    name: 'Business scenarios',
    homePageId: 'profile',
    pageOrder: [...BUSINESS_SCENARIOS],
    pagesById: Object.fromEntries(pages.map(page => [page.id, page])),
    registryLock: structuredClone(adapter.componentRegistry.lock),
    settings: {},
    resources: {},
  }
  const originalSnapshot = createProjectSnapshot(document, 23)
  const persistedJSON = JSON.stringify(originalSnapshot.document)
  const restored = assertProjectDocument(JSON.parse(persistedJSON))
  const snapshot = createProjectSnapshot(restored, originalSnapshot.editVersion)
  const result = compileCanonicalProject({ snapshot, registry: adapter.registrySnapshot })
  if (!result.success)
    throw new Error(JSON.stringify(result.diagnostics))
  const compilation = result.compilation
  const sourceResolver: CanonicalSourceBindingResolver = {
    ...adapter.sourceResolver,
    resolveAction: ref => ref === 'host.businessAudit'
      ? {
          exportName: 'record',
          module: {
            kind: 'file',
            path: 'src/actions/business-audit.ts',
            content: 'export const calls: unknown[] = []\nexport function record(input: unknown): unknown { calls.push(input); return input }\n',
          },
        }
      : undefined,
  }
  const runtimeResolver = {
    ...adapter.runtimeResolver,
    adapter: sourceResolver.adapter,
    adapterVersion: sourceResolver.adapterVersion,
    registryFingerprint: sourceResolver.registryFingerprint,
  }
  function direct(pageId: BusinessScenario) {
    const runtime = compileCanonicalPageRuntime({ compilation, pageId }, runtimeResolver)
    if (!runtime.success)
      throw new Error(JSON.stringify(runtime.diagnostics))
    return runtime.artifact
  }
  return {
    provider,
    adapter,
    document,
    originalSnapshot,
    persistedJSON,
    snapshot,
    compilation,
    runtimeResolver,
    direct,
    exportConfig: () => createCanonicalProjectConfigExport(compilation, sourceResolver),
    exportSource: () => createCanonicalProjectSourceExport(compilation, sourceResolver),
  }
}

export function generatedBusinessFiles(files: Readonly<Record<string, WorkspaceFile>>): Record<string, string> {
  return Object.fromEntries(Object.entries(files).flatMap(([path, file]) => {
    if (file.kind !== 'text')
      return []
    if (typeof file.content !== 'string')
      throw new TypeError(`Generated text file is not text: ${path}`)
    return [[path, file.content]]
  }))
}

/** The shared module loader executes the generated factory; no second evaluator lives in this fixture. */
export async function loadBusinessConfig(fixture: BusinessScenariosFixture) {
  const exported = fixture.exportConfig()
  const load = await createGeneratedModuleLoader(generatedBusinessFiles(exported.files))
  return load(exported.entry)
}

export async function loadBusinessSource(fixture: BusinessScenariosFixture) {
  const exported = fixture.exportSource()
  return createGeneratedModuleLoader(generatedBusinessFiles(exported.files))
}
