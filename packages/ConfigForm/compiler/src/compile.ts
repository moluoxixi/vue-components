import type {
  ConfigFormFlow,
  ConfigFormFlowDiagnostic,
} from '@moluoxixi/config-form-core'
import type {
  LayoutNode,
  ModelJsonObject,
  NodeId,
  PageGraph,
  PageNode,
  ProjectDocument,
  ProjectPage,
  RegistryContractComponentSnapshot,
  RegistryContractSnapshot,
  SlotName,
} from '@moluoxixi/config-form-model'
import type {
  CanonicalFlowIR,
  CanonicalNodeIR,
  CanonicalNodePlacement,
  CanonicalPageIR,
  CanonicalProjectIR,
  CanonicalProjectIRDocument,
  CompileCanonicalProjectInput,
  CompileCanonicalProjectResult,
  ProjectCompilation,
  SemanticCompilerDiagnostic,
  SemanticCompilerEnvironment,
} from './types'
import {
  analyzeConfigFormFlow,
  getConfigFormFlowSemanticHash,
  getConfigFormJsonSemanticHash,
} from '@moluoxixi/config-form-core'
import {
  parseProjectCompilationSnapshot,
  parseRegistryContractSnapshot,
} from '@moluoxixi/config-form-model'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
} from './types'

const DEFAULT_ENVIRONMENT: SemanticCompilerEnvironment = {
  version: '1',
  features: {},
}

interface CompilePageContext {
  pageId: string
  graph: PageGraph
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>
  diagnostics: SemanticCompilerDiagnostic[]
  nodesById: Record<NodeId, CanonicalNodeIR>
}

export function compileCanonicalProject(input: CompileCanonicalProjectInput): CompileCanonicalProjectResult {
  const snapshotResult = parseProjectCompilationSnapshot(input.snapshot)
  if (!snapshotResult.success)
    return { success: false, diagnostics: snapshotResult.diagnostics }
  const registryResult = parseRegistryContractSnapshot(input.registry)
  if (!registryResult.success)
    return { success: false, diagnostics: registryResult.diagnostics }

  const snapshot = snapshotResult.data
  const isDraft = 'kind' in snapshot
  const contentHash = isDraft ? snapshot.draftHash : snapshot.contentHash
  const project = snapshot.document as ProjectDocument
  const registry = registryResult.data
  const diagnostics: SemanticCompilerDiagnostic[] = []
  validateRegistryLock(project, registry, diagnostics)
  const environment = normalizeEnvironment(input.environment, diagnostics)
  if (!environment || diagnostics.length > 0)
    return { success: false, diagnostics }

  const contracts = new Map(registry.components.map(component => [component.key, component]))
  const pagesById: Record<string, CanonicalPageIR> = Object.create(null)
  project.pageOrder.forEach((pageId) => {
    const page = project.pagesById[pageId]
    if (!page)
      return
    const compiled = compilePage(page, contracts, diagnostics)
    if (compiled)
      pagesById[pageId] = compiled
  })
  if (diagnostics.length > 0)
    return { success: false, diagnostics }

  const environmentHash = semanticHash(environment)
  const base = {
    version: CANONICAL_PROJECT_IR_VERSION,
    identity: {
      projectId: project.id,
      contentHash,
      registryAdapter: registry.adapter,
      registryAdapterVersion: registry.adapterVersion,
      registryFingerprint: registry.fingerprint,
      compilerVersion: CONFIG_FORM_COMPILER_VERSION,
      environmentHash,
      irHash: '',
    },
    name: project.name,
    homePageId: project.homePageId,
    pageOrder: [...project.pageOrder],
    pagesById,
    settings: clone(project.settings),
    resources: clone(project.resources),
    environment,
  } satisfies CanonicalProjectIRDocument
  const { contentHash: _contentHash, irHash: _irHash, ...semanticIdentity } = base.identity
  base.identity.irHash = semanticHash({ ...base, identity: semanticIdentity })
  const ir = deepFreeze(base) as CanonicalProjectIR
  const compilation = deepFreeze({
    snapshot,
    registry,
    origin: isDraft
      ? {
          kind: 'draft' as const,
          baseEditVersion: snapshot.base.editVersion,
          draftId: snapshot.draftId,
        }
      : {
          kind: 'committed' as const,
          editVersion: snapshot.editVersion,
        },
    key: ir.identity,
    ir,
  }) as ProjectCompilation
  return { success: true, compilation, diagnostics: [] }
}

function compilePage(
  page: ProjectPage,
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>,
  diagnostics: SemanticCompilerDiagnostic[],
): CanonicalPageIR | undefined {
  const { graph } = page
  const pageId = page.id
  const nodesById: Record<NodeId, CanonicalNodeIR> = Object.create(null)
  const context: CompilePageContext = { pageId, graph, registry, diagnostics, nodesById }
  graph.root.forEach((item, index) => compileNode(context, item.nodeId, [], {
    parentId: null,
    slot: null,
    index,
    props: clone(item.placement),
  }))
  const flows = compileFlows(page.flows ?? [], pageId, diagnostics)
  if (diagnostics.length > 0)
    return undefined
  return {
    id: pageId,
    name: page.name,
    route: page.route,
    props: clone(graph.props),
    form: clone(graph.form),
    rootIds: graph.root.map(item => item.nodeId),
    nodesById,
    flows,
  }
}

function compileNode(
  context: CompilePageContext,
  nodeId: NodeId,
  ancestors: NodeId[],
  placement: CanonicalNodePlacement,
): void {
  const node = context.graph.nodesById[nodeId]
  if (!node) {
    context.diagnostics.push({
      code: 'COMPILER_NODE_UNKNOWN',
      message: `Page graph references an unknown node: ${nodeId}`,
      pageId: context.pageId,
      nodeId,
    })
    return
  }
  const component = context.registry.get(node.component)
  if (!component) {
    context.diagnostics.push({
      code: 'COMPILER_COMPONENT_UNKNOWN',
      message: `Component is not present in the registry snapshot: ${node.component}`,
      pageId: context.pageId,
      nodeId,
    })
    return
  }
  if (component.contract.kind !== node.kind) {
    context.diagnostics.push({
      code: 'COMPILER_COMPONENT_KIND_MISMATCH',
      message: `Component ${node.component} does not support node kind ${node.kind}.`,
      pageId: context.pageId,
      nodeId,
    })
    return
  }

  const path = [...ancestors, node.id]
  const common = compileNodeBase(node, component, path, placement)
  if (node.kind === 'field') {
    context.nodesById[node.id] = {
      ...common,
      kind: 'field',
      field: node.field,
      ...(node.label === undefined ? {} : { label: node.label }),
      ...(node.defaultValue === undefined ? {} : { defaultValue: clone(node.defaultValue) }),
      ...(node.validation === undefined ? {} : { validation: clone(node.validation) }),
      ...(node.validateOn === undefined ? {} : { validateOn: clone(node.validateOn) }),
    }
    return
  }

  const slots: Record<SlotName, NodeId[]> = Object.create(null)
  context.nodesById[node.id] = { ...common, kind: 'layout', slots }
  Object.entries(node.slots).forEach(([slotName, children]) => {
    if (!validateSlot(component.contract, node, slotName, context))
      return
    slots[slotName] = children.map(item => item.nodeId)
    children.forEach((item, index) => compileNode(context, item.nodeId, path, {
      parentId: node.id,
      slot: slotName,
      index,
      props: clone(item.placement),
    }))
  })
}

function compileNodeBase(
  node: PageNode,
  component: RegistryContractComponentSnapshot,
  path: NodeId[],
  placement: CanonicalNodePlacement,
) {
  return {
    id: node.id,
    component: node.component,
    componentVersion: component.contractVersion,
    componentFingerprint: component.fingerprint,
    path,
    placement,
    configuredProps: clone(node.props),
    props: mergeProps(component.contract.defaults, node.props),
    events: clone(node.events),
    bindings: clone(node.bindings),
    ...(node.extensions === undefined ? {} : { extensions: clone(node.extensions) }),
    ...(node.conditions === undefined ? {} : { conditions: clone(node.conditions) }),
    ...(node.reactions === undefined ? {} : { reactions: clone(node.reactions) }),
  }
}

function validateSlot(
  contract: RegistryContractComponentSnapshot['contract'],
  node: LayoutNode,
  slotName: string,
  context: CompilePageContext,
): boolean {
  if (contract.slots.some(slot => slot.name === slotName))
    return true
  context.diagnostics.push({
    code: 'COMPILER_SLOT_UNKNOWN',
    message: `Component ${node.component} does not declare slot ${slotName}.`,
    pageId: context.pageId,
    nodeId: node.id,
  })
  return false
}

function compileFlows(
  flows: ConfigFormFlow[],
  pageId: string,
  diagnostics: SemanticCompilerDiagnostic[],
): CanonicalFlowIR[] {
  return flows.flatMap((flow) => {
    const semanticFlow = withoutFlowPositions(flow)
    const result = analyzeConfigFormFlow(semanticFlow)
    if (!result.success) {
      diagnostics.push(...result.diagnostics.map(diagnostic => flowDiagnostic(pageId, diagnostic)))
      return []
    }
    return [{
      semanticHash: getConfigFormFlowSemanticHash(semanticFlow),
      plan: result.plan,
    }]
  })
}

function flowDiagnostic(pageId: string, diagnostic: ConfigFormFlowDiagnostic): SemanticCompilerDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    pageId,
    ...(diagnostic.nodeId ? { nodeId: diagnostic.nodeId } : {}),
    ...(diagnostic.path ? { path: diagnostic.path.split('.') } : {}),
  }
}

function validateRegistryLock(
  project: ProjectDocument,
  registry: RegistryContractSnapshot,
  diagnostics: SemanticCompilerDiagnostic[],
): void {
  if (project.registryLock.adapter !== registry.adapter) {
    diagnostics.push({
      code: 'COMPILER_REGISTRY_ADAPTER_MISMATCH',
      message: 'Project registry adapter does not match the compiler registry snapshot.',
      path: ['registryLock', 'adapter'],
    })
    return
  }

  const contracts = new Map(registry.components.map(component => [component.key, component]))
  const usedComponents = new Map<string, { nodeId: string, pageId: string }>()
  Object.values(project.pagesById).forEach((page) => {
    Object.values(page.graph.nodesById).forEach((node) => {
      if (!usedComponents.has(node.component))
        usedComponents.set(node.component, { nodeId: node.id, pageId: page.id })
    })
  })
  for (const [component, location] of [...usedComponents].sort(([left], [right]) => left.localeCompare(right))) {
    const expected = project.registryLock.components[component]
    const actual = contracts.get(component)
    if (!expected) {
      diagnostics.push({
        code: 'COMPILER_REGISTRY_COMPONENT_LOCK_MISSING',
        message: `Project registry lock does not contain component: ${component}`,
        ...location,
        path: ['registryLock', 'components', component],
      })
      continue
    }
    if (!actual) {
      diagnostics.push({
        code: 'COMPILER_COMPONENT_UNKNOWN',
        message: `Component is not present in the registry snapshot: ${component}`,
        ...location,
        path: ['registryLock', 'components', component],
      })
      continue
    }
    if (expected.contractVersion !== actual.contractVersion) {
      diagnostics.push({
        code: 'COMPILER_REGISTRY_COMPONENT_VERSION_MISMATCH',
        message: `Component contract version does not match for ${component}: expected ${expected.contractVersion}, received ${actual.contractVersion}.`,
        ...location,
        path: ['registryLock', 'components', component, 'contractVersion'],
      })
    }
    if (expected.fingerprint !== actual.fingerprint) {
      diagnostics.push({
        code: 'COMPILER_REGISTRY_COMPONENT_FINGERPRINT_MISMATCH',
        message: `Component contract fingerprint does not match for ${component}.`,
        ...location,
        path: ['registryLock', 'components', component, 'fingerprint'],
      })
    }
  }
}

function normalizeEnvironment(
  input: Partial<SemanticCompilerEnvironment> | undefined,
  diagnostics: SemanticCompilerDiagnostic[],
): SemanticCompilerEnvironment | undefined {
  const environment = {
    version: input?.version ?? DEFAULT_ENVIRONMENT.version,
    features: clone(input?.features ?? DEFAULT_ENVIRONMENT.features),
  }
  if (!environment.version.trim()) {
    diagnostics.push({
      code: 'COMPILER_ENVIRONMENT_VERSION_INVALID',
      message: 'Semantic compiler environment requires a non-empty version.',
      path: ['environment', 'version'],
    })
    return undefined
  }
  return environment
}

function mergeProps(
  defaults: RegistryContractComponentSnapshot['contract']['defaults'],
  configured: ModelJsonObject,
): ModelJsonObject {
  return cloneJsonObject({ ...defaults, ...configured })
}

function withoutFlowPositions(flow: ConfigFormFlow): ConfigFormFlow {
  return {
    ...clone(flow),
    nodes: flow.nodes.map(({ position: _position, ...node }) => clone(node)),
  }
}

function semanticHash(value: unknown): string {
  return `fnv1a:${getConfigFormJsonSemanticHash(value)}`
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function cloneJsonObject(value: Readonly<Record<string, unknown>>): ModelJsonObject {
  return structuredClone(value) as ModelJsonObject
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value))
    return value
  Object.values(value).forEach(child => deepFreeze(child))
  return Object.freeze(value)
}
