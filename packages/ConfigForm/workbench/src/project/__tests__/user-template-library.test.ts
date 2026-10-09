import type { ProjectSurface } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import {
  analyzeTemplateEligibility,
  copyTemplate,
  createBlankTemplate,
  createTemplateCatalogService,
  createUserTemplateStore,
  instantiateTemplateSurface,
  templateFromSurface,
} from '..'
import { loadWorkbenchAdapter } from '../../adapters'
import 'fake-indexeddb/auto'

describe('user template library', () => {
  it('stores editable templates independently and makes reusable copies with new node identities', async () => {
    const db = `template-test-${crypto.randomUUID()}`
    const store = createUserTemplateStore(db)
    const adapter = await loadWorkbenchAdapter('element-plus')
    const blank = createBlankTemplate('element-plus', 'dialog')
    const surface = structuredClone(blank.surface)
    surface.graph.nodesById.customer = { id: 'customer', kind: 'field', component: 'element.input', field: 'customer', label: 'Customer', props: {} }
    surface.graph.root = [{ nodeId: 'customer', placement: {} }]
    const entry = templateFromSurface({ surface, name: 'Customer details', description: 'Reusable dialog', registryLock: adapter.componentRegistry.lock })
    await store.put(entry)
    store.close()

    const reopened = createUserTemplateStore(db)
    const catalog = await createTemplateCatalogService([reopened.provider]).load()
    expect(catalog.diagnostics).toEqual([])
    const stored = catalog.templates[0]!
    expect(stored.manifest.displayName).toBe('Customer details')
    expect(stored.surface.kind).toBe('dialog')
    expect(analyzeTemplateEligibility(stored, { target: 'surface', registry: adapter.registrySnapshot, targetLock: adapter.componentRegistry.lock }).eligible).toBe(true)
    const first = instantiateTemplateSurface(stored, { id: 'first', name: 'First' })
    const second = instantiateTemplateSurface(stored, { id: 'second', name: 'Second' })
    expect(first.graph.root[0]!.nodeId).not.toBe(second.graph.root[0]!.nodeId)
    first.graph.nodesById[first.graph.root[0]!.nodeId]!.props.placeholder = 'First only'
    expect(second.graph.nodesById[second.graph.root[0]!.nodeId]!.props.placeholder).toBeUndefined()
    expect((await reopened.list())[0]).toMatchObject({ surface: { graph: { nodesById: { customer: { props: {} } } } } })
    await reopened.remove(stored.manifest.id)
    expect(await reopened.list()).toEqual([])
    reopened.close()
  })

  it('keeps built-in templates read-only and creates a detached personal copy', async () => {
    const store = createUserTemplateStore(`template-test-${crypto.randomUUID()}`)
    const builtIn = createBlankTemplate('antd-vue', 'drawer')
    await expect(store.put(builtIn)).rejects.toThrow('read-only')
    await expect(store.remove(builtIn.manifest.id)).rejects.toThrow('read-only')
    const personal = copyTemplate(builtIn, 'My drawer')
    await store.put(personal)
    personal.surface.graph.form.labelWidth = 140
    expect(builtIn.surface.graph.form.labelWidth).not.toBe(140)
    expect(await store.list()).toHaveLength(1)
    store.close()
  })

  it('rejects references to source-project surfaces before persisting a template', async () => {
    const adapter = await loadWorkbenchAdapter('element-plus')
    const surface = createBlankTemplate('element-plus', 'page').surface as ProjectSurface
    surface.graph.nodesById.link = { id: 'link', kind: 'element', component: 'element.button', props: { text: 'Continue' } }
    surface.graph.root = [{ nodeId: 'link', placement: {} }]
    surface.interactions = [{
      kind: 'primaryUiAction',
      id: 'external-navigation',
      nodeId: 'link',
      trigger: 'activate',
      action: { kind: 'navigate', targetSurfaceId: 'other-page', parameters: [] },
    }]
    expect(() => templateFromSurface({ surface, name: 'Linked page', description: '', registryLock: adapter.componentRegistry.lock })).toThrow()
  })
})
