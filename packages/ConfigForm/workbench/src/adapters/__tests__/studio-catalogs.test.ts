import type { StudioCatalog } from '@moluoxixi/config-form-studio'
import type { ProjectTemplateSeed } from '../../project/templates/types'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { surfaceNodeSchema } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { builtInTemplateCatalogProvider } from '../../project/templates/adapters/built-in-provider'
import { loadWorkbenchAdapter } from '../services/load'

describe('portable Studio catalogs', () => {
  it.each(['element-plus', 'antd-vue'] as const)('matches actual designer and source bindings for %s', async (preset) => {
    const adapter = await loadWorkbenchAdapter(preset)
    const materials = adapter.designerRegistry.listMaterials()
    const templates = await builtInTemplateCatalogProvider.list() as ProjectTemplateSeed[]
    const catalog: StudioCatalog = {
      version: 1,
      preset,
      materials: materials.map((material) => {
        const contract = adapter.componentRegistry.get(material.key)!
        const lock = adapter.registrySnapshot.components.find(component => component.key === material.key)!
        const resolved = adapter.sourceComponentResolver.resolveComponent({ componentKey: material.key, contractVersion: lock.contractVersion, contractFingerprint: lock.fingerprint })
        if (!resolved.success)
          throw new Error(resolved.reason)
        const node = material.createNode({ id: '__studio_node__', ...(material.kind === 'field' ? { field: '__studio_field__' } : {}) })
        const subgraph = 'root' in node ? node : { root: [{ nodeId: node.id, placement: {} }], nodesById: { [node.id]: node } }
        return {
          contract,
          title: adapter.locale.materials?.[material.key]?.title ?? material.title,
          category: adapter.locale.materials?.[material.key]?.category ?? material.category,
          properties: material.setters.map(setter => ({ key: setter.key, path: setter.path, label: setter.label, control: setter.control, ...(setter.options ? { options: setter.options } : {}) })),
          defaultSubgraph: { root: subgraph.root, nodesById: Object.fromEntries(Object.entries(subgraph.nodesById).map(([id, node]) => [id, surfaceNodeSchema.parse({ ...node, props: node.props ?? {} })])) },
          resolution: resolved.value,
        }
      }),
      templates: templates.filter(template => template.manifest.adapter === preset).map(template => ({ id: template.manifest.id, name: template.manifest.displayName, description: template.manifest.description, preset, tags: template.manifest.tags, surface: template.surface })),
    }
    const path = resolve(import.meta.dirname, '../../../../studio/src/constants', `${preset}.json`)
    const json = `${JSON.stringify(catalog, null, 2)}\n`
    if (process.env.CONFIG_FORM_UPDATE_CATALOGS === '1') {
      await mkdir(resolve(path, '..'), { recursive: true })
      await writeFile(path, json)
    }
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(JSON.parse(json))
  }, 30_000)
})
