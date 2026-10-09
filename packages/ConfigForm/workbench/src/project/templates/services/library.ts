import type { DeepReadonly, ProjectSurface, RegistryLock } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapterId } from '../../../adapters'
import type { ProjectTemplateCatalogEntry, ProjectTemplateSeed } from '../types'
import { getBuiltInTemplateSeed } from '../adapters/built-in-provider'
import { parseProjectTemplateSeed } from './catalog'

export function createBlankTemplate(adapter: WorkbenchAdapterId, kind: ProjectSurface['kind']): ProjectTemplateCatalogEntry {
  const prefix = adapter === 'element-plus' ? 'element' : 'antd'
  const seed = getBuiltInTemplateSeed(`${prefix}-${kind === 'page' ? 'blank' : kind}`)!
  return { ...seed, providerId: 'built-in' }
}

export function copyTemplate(template: ProjectTemplateSeed, name: string): ProjectTemplateCatalogEntry {
  const copy = structuredClone({ manifest: template.manifest, surface: template.surface })
  copy.manifest.id = `custom-${crypto.randomUUID()}`
  copy.manifest.displayName = name.trim()
  copy.manifest.order = 0
  copy.surface.name = name.trim()
  return { ...copy, providerId: 'personal' }
}

/** A reusable template must be independent of the source project's assets. */
export function templateFromSurface(input: {
  surface: DeepReadonly<ProjectSurface>
  registryLock: RegistryLock
  name: string
  description: string
  id?: string
}): ProjectTemplateCatalogEntry {
  const adapter = input.registryLock.adapter
  if (adapter !== 'element-plus' && adapter !== 'antd-vue')
    throw new TypeError(`Unsupported component library: ${adapter}`)
  const surface = structuredClone(input.surface) as ProjectSurface
  surface.name = input.name.trim()
  const components = [...new Set(Object.values(surface.graph.nodesById).map(node => node.component))]
    .map(key => ({ key, ...input.registryLock.components[key] }))
  const parsed = parseProjectTemplateSeed({
    surface,
    manifest: {
      id: input.id ?? `custom-${crypto.randomUUID()}`,
      version: 1,
      displayName: input.name.trim(),
      description: input.description.trim() || input.name.trim(),
      adapter,
      category: surface.graph.root.length ? 'starter' : 'blank',
      order: 0,
      tags: [surface.kind],
      registry: { adapter, components },
      preview: { preferredViewport: 'desktop', surfaceId: surface.id },
    },
  }, 'personal')
  if ('code' in parsed)
    throw new TypeError(parsed.message)
  return { ...parsed, providerId: 'personal' }
}
