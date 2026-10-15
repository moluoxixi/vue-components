import type { ModelJsonObject, NodeSubgraph, ProjectDataset, ProjectDocument, ProjectSurface, SurfaceNode } from '@moluoxixi/config-form-model'
import type { GenerateProjectSourceInput } from '@moluoxixi/config-form-source/generator'
import type { StudioPresetId } from '../types'
import { assertProjectDocument, PROJECT_DOCUMENT_VERSION, PROJECT_THEME_VERSION, SURFACE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { generateProjectSource as generate } from '@moluoxixi/config-form-source/generator'
import { getStudioCatalog, getStudioPreset } from './presets'

export function generateProjectSource(input: Omit<GenerateProjectSourceInput, 'preset'> & { preset: StudioPresetId | GenerateProjectSourceInput['preset'] }) {
  return generate({ ...input, preset: typeof input.preset === 'string' ? getStudioPreset(input.preset) : input.preset })
}
export function createStudioProject(input: {
  id: string
  name: string
  preset: StudioPresetId
  templateId?: string
  surfaces?: ProjectSurface[]
  datasets?: ProjectDataset[]
}): ProjectDocument {
  if (input.templateId && input.surfaces)
    throw new TypeError('Choose templateId or surfaces when creating a project.')
  const catalog = getStudioCatalog(input.preset)
  const preset = getStudioPreset(input.preset)
  const template = input.templateId ? catalog.templates.find(template => template.id === input.templateId) : undefined
  if (input.templateId && !template)
    throw new TypeError(`Template is not available for ${input.preset}: ${input.templateId}`)
  const surfaces = input.surfaces ?? (template
    ? [structuredClone(template.surface)]
    : [{
        id: 'home',
        kind: 'page' as const,
        name: input.name,
        route: '/',
        parameters: [],
        outputs: [],
        interactions: [],
        graph: { version: SURFACE_GRAPH_VERSION, props: {}, form: { columns: 24, fieldSpan: 24, responsive: { mobile: { columns: 1, fieldSpan: 1 } } }, root: [], nodesById: {} },
      }])
  if (new Set(surfaces.map(surface => surface.id)).size !== surfaces.length)
    throw new TypeError('Surface IDs must be unique.')
  const datasets = input.datasets ?? []
  if (new Set(datasets.map(dataset => dataset.id)).size !== datasets.length)
    throw new TypeError('Dataset IDs must be unique.')
  return assertProjectDocument({
    version: PROJECT_DOCUMENT_VERSION,
    id: input.id,
    name: input.name,
    homeSurfaceId: surfaces.find(surface => surface.kind === 'page')?.id ?? '',
    surfaceOrder: surfaces.map(surface => surface.id),
    surfacesById: Object.fromEntries(surfaces.map(surface => [surface.id, surface])),
    datasetOrder: datasets.map(dataset => dataset.id),
    datasetsById: Object.fromEntries(datasets.map(dataset => [dataset.id, dataset])),
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    settings: {},
    registryLock: {
      adapter: input.preset,
      version: preset.registry.adapterVersion,
      fingerprint: preset.registry.fingerprint,
      components: Object.fromEntries(preset.registry.components.map(contract => [contract.key, { contractVersion: contract.contractVersion, fingerprint: contract.fingerprint }])),
    },
  })
}
/** Get a ready-to-insert node subtree without guessing material defaults or slots. */
export function createStudioNode(input: { preset: StudioPresetId, component: string, id: string, field?: string, label?: string, props?: ModelJsonObject }): NodeSubgraph {
  const material = getStudioCatalog(input.preset).materials.find(material => material.contract.key === input.component)
  if (!material)
    throw new TypeError(`Unknown component: ${input.component}`)
  if (material.contract.kind === 'field' && !input.field?.trim())
    throw new TypeError('Field materials require a field name.')
  const subgraph = structuredClone(material.defaultSubgraph)
  const rootId = subgraph.root[0]!.nodeId
  const ids = new Map(Object.keys(subgraph.nodesById).map((id, index) => [id, id === rootId ? input.id : `${input.id}-${index}`]))
  const renameItems = (items: NodeSubgraph['root']) => items.map(item => ({ ...item, nodeId: ids.get(item.nodeId)! }))
  subgraph.root = renameItems(subgraph.root)
  subgraph.nodesById = Object.fromEntries(Object.values(subgraph.nodesById).map((node): [string, SurfaceNode] => {
    node.id = ids.get(node.id)!
    if (node.kind === 'layout')
      node.slots = Object.fromEntries(Object.entries(node.slots).map(([slot, items]) => [slot, renameItems(items)]))
    if (node.id === input.id) {
      node.props = { ...node.props, ...input.props }
      if (node.kind === 'field') {
        node.field = input.field!
        if (input.label !== undefined)
          node.label = input.label
      }
      if (node.kind === 'layout' && node.valueScope && input.field !== undefined)
        node.valueScope.field = input.field
    }
    return [node.id, node]
  }))
  return subgraph
}
