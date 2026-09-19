import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { LayoutNode, SurfaceGraph, SurfaceNode, ProjectDocument } from '@moluoxixi/config-form-model'
import type { NestedMaterialProvider } from './types'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import {
  createComponentContractRegistry,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'
import { compileCanonicalSurfaceRuntime } from '@moluoxixi/config-form-vue-backend'

export type { NestedMaterialProvider } from './types'

export function createNestedMaterialFixture(provider: NestedMaterialProvider, populated = true) {
  const registry = provider.createRegistry()
  const contracts = createComponentContractRegistry(provider.capabilities.contracts, { adapter: provider.prefix, version: '1' })
  const graph: SurfaceGraph = { version: SURFACE_GRAPH_VERSION, props: {}, form: { labelPosition: 'top' }, root: [], nodesById: {} }
  function add(material: string, id: string, field: string, parent?: string): SurfaceNode {
    const subgraph = registry.createSubgraph(`${provider.prefix}.${material}`, { id, field })
    Object.assign(graph.nodesById, subgraph.nodesById)
    if (parent)
      (graph.nodesById[parent] as LayoutNode).slots.default!.push(...subgraph.root)
    else
      graph.root.push(...subgraph.root)
    return graph.nodesById[id]!
  }
  if (populated) {
    add('object-group', 'buyer', 'buyer')
    add('input', 'buyer-name', 'name', 'buyer')
    add('object-group', 'seller', 'seller')
    add('input', 'seller-name', 'name', 'seller')
    const orders = add('detail-table', 'orders', 'orders') as LayoutNode
    orders.props.title = 'Order details'
    orders.valueScope = { kind: 'array', field: 'orders', minItems: 1, maxItems: 3 }
    const sku = add('input', 'sku', 'sku', 'orders')
    if (sku.kind === 'field') {
      sku.label = 'SKU'
      sku.defaultValue = 'New SKU'
      sku.validation = {
        version: 1,
        base: { type: 'string' },
        rules: [{ kind: 'required' }],
      }
    }
    const delivery = add('object-group', 'delivery', 'delivery', 'orders')
    delivery.props.title = 'Delivery'
    add('input', 'city', 'city', 'delivery')
    const lines = add('array-subform', 'lines', 'lines', 'orders') as LayoutNode
    lines.props.title = 'Lines'
    lines.valueScope = { kind: 'array', field: 'lines', minItems: 1, maxItems: 2 }
    const lineName = add('input', 'line-name', 'name', 'lines')
    if (lineName.kind === 'field') {
      lineName.label = 'Line name'
      lineName.defaultValue = 'New line'
    }
  }
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: `${provider.prefix}-nested`,
    name: 'Nested materials',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    surfacesById: {
      home: {
        id: 'home',
        kind: 'page',
        name: 'Home',
        route: '/',
        graph,
        parameters: [],
        outputs: [],
        interactions: [],
      },
    },
    datasetOrder: [],
    datasetsById: {},
    registryLock: structuredClone(contracts.lock),
    settings: {},
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
  }
  function compile() {
    const compiled = compileCanonicalProject({ snapshot: createProjectSnapshot(document, 0), registry: createRegistryContractSnapshot(contracts) })
    if (!compiled.success)
      throw new Error(JSON.stringify(compiled.diagnostics))
    const result = compileCanonicalSurfaceRuntime({ compilation: compiled.compilation, surfaceId: 'home' }, {
      components: registry.components,
      resolveBinding(component) {
        const entry = provider.capabilities.get(component)
        const identity = contracts.lock.components[component]
        if (!entry || !identity)
          return undefined
        const binding = entry.runtime.binding
        return {
          component: binding.component,
          kind: entry.runtime.kind,
          contractFingerprint: identity.fingerprint,
          contractVersion: identity.contractVersion,
          valueProp: binding.valueProp,
          trigger: binding.trigger,
          blurTrigger: binding.blurTrigger,
          ...(binding.readonlyRender
            ? {
                readonlyRender: ({ node, componentProps, model, value }) => {
                  const source = graph.nodesById[node.id]!
                  if (source.kind !== 'field')
                    throw new Error(`Readonly field missing: ${node.id}`)
                  return binding.readonlyRender!({ node: source, componentProps, model, value })
                },
              }
            : {}),
        }
      },
    })
    if (!result.success)
      throw new Error(JSON.stringify(result.diagnostics))
    return result.artifact.renderer
  }
  return { registry, contracts, graph, document, compile }
}

export function nestedMaterialValues(): ConfigFormValues {
  return {
    buyer: { name: 'Buyer' },
    seller: { name: 'Seller' },
    orders: [
      { sku: 'First', delivery: { city: 'London' }, lines: [{ name: 'First line' }] },
      { sku: 'Second', delivery: { city: 'Paris' }, lines: [{ name: 'Second line' }] },
    ],
  }
}
