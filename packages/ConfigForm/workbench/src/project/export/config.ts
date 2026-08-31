import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type {
  PageNode,
  ProjectPage,
  RegistryContractComponentSnapshot,
} from '@moluoxixi/config-form-model'
import type { ProjectPath, WorkspaceFile } from '../types'
import type {
  CanonicalSourceBindingResolver,
  CanonicalSourceComponentBinding,
} from './canonical-bindings'
import { normalizeProjectPath, safeProjectSlug } from '../path'
import {
  formatDefineField,
  formatStaticValue,
  formatValueModel,
} from './serialization'

export interface CanonicalConfigExport {
  entry: ProjectPath
  files: Record<ProjectPath, WorkspaceFile>
}

interface ConfigGenerationContext {
  contracts: ReadonlyMap<string, RegistryContractComponentSnapshot>
  page: ProjectPage
  resolver: CanonicalSourceBindingResolver
}

function textFile(content: string, language: string): WorkspaceFile {
  return { content, kind: 'text', language }
}

function bindingFor(
  component: string,
  context: ConfigGenerationContext,
): CanonicalSourceComponentBinding {
  const contract = context.contracts.get(component)
  if (!contract)
    throw new Error(`Component "${component}" is absent from the compilation Registry snapshot.`)
  const binding = context.resolver.resolveBinding(component)
  if (!binding)
    throw new Error(`Component "${component}" has no Config source binding.`)
  if (
    binding.component !== component
    || binding.contractVersion !== contract.contractVersion
    || binding.contractFingerprint !== contract.fingerprint
  ) {
    throw new Error(`Component "${component}" Config source binding does not match the compilation Registry snapshot.`)
  }
  return binding
}

function initialValue(node: Extract<PageNode, { kind: 'field' }>, binding: CanonicalSourceComponentBinding): unknown {
  if (node.defaultValue !== undefined)
    return node.defaultValue
  if (binding.defaultValue !== undefined)
    return binding.defaultValue
  if (binding.configComponent === 'boolean')
    return false
  if (binding.configComponent === 'number')
    return 0
  if (binding.configComponent === 'select' && binding.component.endsWith('.checkbox'))
    return []
  return ''
}

function designerMetadata(node: PageNode, placement: Record<string, unknown>): Record<string, unknown> {
  return {
    id: node.id,
    material: node.component,
    placement,
    ...(Object.keys(node.events).length === 0 ? {} : { events: node.events }),
    ...(Object.keys(node.bindings).length === 0 ? {} : { bindings: node.bindings }),
    ...(node.kind === 'field' ? { hasDefaultValue: node.defaultValue !== undefined } : {}),
    ...(node.conditions === undefined ? {} : { conditions: node.conditions }),
    ...(node.kind === 'field' && node.validation !== undefined ? { validation: node.validation } : {}),
  }
}

function runtimeNode(
  node: PageNode,
  placement: Record<string, unknown>,
  context: ConfigGenerationContext,
  ancestors: ReadonlySet<string>,
): Record<string, unknown> {
  if (ancestors.has(node.id))
    throw new Error(`Page "${context.page.id}" contains a node cycle at "${node.id}".`)
  const binding = bindingFor(node.component, context)
  const span = placement.span
  const base: Record<string, unknown> = {
    component: binding.configComponent,
    ...(Object.keys(node.props).length === 0 ? {} : { props: node.props }),
    ...(typeof span === 'number' ? { span } : {}),
    ...(node.reactions === undefined ? {} : { reactions: node.reactions }),
    extensions: {
      ...(node.extensions ?? {}),
      'mx.config-form-designer': designerMetadata(node, placement),
    },
  }
  if (node.kind === 'field') {
    return {
      ...base,
      field: node.field,
      ...(node.label === undefined ? {} : { label: node.label }),
      ...(node.validateOn === undefined ? {} : { validateOn: node.validateOn }),
    }
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(node.id)
  return {
    ...base,
    slots: Object.fromEntries(Object.entries(node.slots).map(([slotName, items]) => [
      slotName,
      items.map((item) => {
        const child = context.page.graph.nodesById[item.nodeId]
        if (!child)
          throw new Error(`Page "${context.page.id}" references unknown node "${item.nodeId}".`)
        return runtimeNode(child, item.placement, context, nextAncestors)
      }),
    ])),
  }
}

function collectInitialValues(
  node: PageNode,
  context: ConfigGenerationContext,
  values: Record<string, unknown>,
  ancestors: ReadonlySet<string>,
): void {
  if (ancestors.has(node.id))
    throw new Error(`Page "${context.page.id}" contains a node cycle at "${node.id}".`)
  const nextAncestors = new Set(ancestors)
  nextAncestors.add(node.id)
  const binding = bindingFor(node.component, context)
  if (node.kind === 'field') {
    values[node.field] = structuredClone(initialValue(node, binding))
    return
  }
  Object.values(node.slots).forEach(items => items.forEach((item) => {
    const child = context.page.graph.nodesById[item.nodeId]
    if (!child)
      throw new Error(`Page "${context.page.id}" references unknown node "${item.nodeId}".`)
    collectInitialValues(child, context, values, nextAncestors)
  }))
}

function pageConfigSource(page: ProjectPage, context: ConfigGenerationContext): string {
  const values: Record<string, unknown> = {}
  const fields = page.graph.root.map((item) => {
    const node = page.graph.nodesById[item.nodeId]
    if (!node)
      throw new Error(`Page "${page.id}" references unknown root node "${item.nodeId}".`)
    collectInitialValues(node, context, values, new Set())
    return runtimeNode(node, item.placement, context, new Set())
  })
  const fieldsSource = fields.length === 0
    ? '[]'
    : `[\n${fields.map(field => `  ${formatDefineField(field, 1)}`).join(',\n')}\n]`
  const flows = page.flows ?? []
  const flowSource = flows.length === 0
    ? '[]'
    : `[\n${flows.map(flow => `  defineFlow(${formatStaticValue(flow, 1)})`).join(',\n')}\n]`
  return `import { defineFlow } from '@moluoxixi/config-form-core'
import { defineFields } from '@moluoxixi/config-form-headless'

${formatValueModel(values)}

const { defineField } = defineFields<PageFormValues>()

export const graph = ${formatStaticValue({
  version: page.graph.version,
  props: page.graph.props,
})}

export const form = ${formatStaticValue(page.graph.form)}

export const initialValues: PageFormValues = ${formatStaticValue(values)}

export const fields = ${fieldsSource}

export const flows = ${flowSource}
`
}

function uniquePageDirectories(pages: readonly ProjectPage[]): ReadonlyMap<string, string> {
  const used = new Set<string>()
  return new Map(pages.map((page) => {
    const base = safeProjectSlug(page.id)
    let directory = base
    let suffix = 2
    while (used.has(directory)) {
      directory = `${base}-${suffix}`
      suffix += 1
    }
    used.add(directory)
    return [page.id, directory]
  }))
}

export function createCanonicalProjectConfigExport(
  compilation: ProjectCompilation,
  resolver: CanonicalSourceBindingResolver,
): CanonicalConfigExport {
  if (
    resolver.adapter !== compilation.key.registryAdapter
    || resolver.adapterVersion !== compilation.key.registryAdapterVersion
    || resolver.registryFingerprint !== compilation.key.registryFingerprint
  ) {
    throw new Error('Config source resolver does not match the ProjectCompilation Registry identity.')
  }

  const document = compilation.snapshot.document
  const pages = document.pageOrder.map((pageId) => {
    const page = document.pagesById[pageId]
    if (!page)
      throw new Error(`Project document references unknown page "${pageId}".`)
    return page as ProjectPage
  })
  const directories = uniquePageDirectories(pages)
  const contracts = new Map(compilation.registry.components.map(component => [component.key, component]))
  const files: Record<ProjectPath, WorkspaceFile> = {}

  pages.forEach((page) => {
    const path = normalizeProjectPath(`pages/${directories.get(page.id)}/form.config.ts`)
    files[path] = textFile(pageConfigSource(page, { contracts, page, resolver }), 'typescript')
  })

  const entry = normalizeProjectPath('project.config.ts')
  const projectPages = pages.map(page => ({
    id: page.id,
    name: page.name,
    route: page.route,
    config: `./pages/${directories.get(page.id)}/form.config`,
  }))
  files[entry] = textFile(`export const project = ${formatStaticValue({
    schemaVersion: document.schemaVersion,
    id: document.id,
    name: document.name,
    homePageId: document.homePageId,
    pages: projectPages,
    settings: document.settings,
    resources: document.resources,
    registryLock: document.registryLock,
  })}\n`, 'typescript')

  return { entry, files }
}
