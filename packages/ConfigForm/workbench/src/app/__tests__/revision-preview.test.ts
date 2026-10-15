import { createMemoryProjectRepository } from '@moluoxixi/config-form-model'
import { createStudioProject } from '@moluoxixi/config-form-studio'
import { describe, expect, it } from 'vitest'
import { loadRevisionPreview, prepareRevisionPreview } from '../services/revision-preview'

describe('saved revision preview', () => {
  it.each(['element-plus', 'antd-vue'] as const)('opens a selected page and retains its compilation at the saved revision for %s', (preset) => {
    const document = createStudioProject({ id: 'preview-project', name: 'Preview', preset, templateId: preset === 'element-plus' ? 'element-profile' : 'antd-profile' })
    const input = structuredClone(document)
    const preview = prepareRevisionPreview({ document, repositoryRevision: 3, surfaceId: document.homeSurfaceId })
    document.surfacesById[document.homeSurfaceId]!.name = 'Later edit'
    expect(preview.name).toBe('Profile form')
    expect(preview.revision).toMatch(/^saved:3:/)
    expect(preview.compilation.ir.homeSurfaceId).toBe(input.homeSurfaceId)
    expect(preview.session.projectId).toBe(input.id)
  })

  it.each(['element-plus', 'antd-vue'] as const)('provides an interactive opener for an overlay-only project with %s', (preset) => {
    const document = createStudioProject({ id: 'dialog-preview', name: 'Dialog', preset, templateId: preset === 'element-plus' ? 'element-dialog' : 'antd-dialog' })
    const original = JSON.stringify(document)
    const surfaceId = document.surfaceOrder[0]!
    const preview = prepareRevisionPreview({ document, repositoryRevision: 0, surfaceId })
    const host = preview.compilation.ir.surfacesById[preview.compilation.ir.homeSurfaceId]!
    expect(host.interactions).toEqual(expect.arrayContaining([expect.objectContaining({ action: expect.objectContaining({ kind: 'open', targetSurfaceId: surfaceId }) })]))
    expect(JSON.stringify(document)).toBe(original)
  })

  it('reports unavailable surfaces before creating a runtime session', () => {
    const document = createStudioProject({ id: 'missing', name: 'Preview', preset: 'element-plus' })
    expect(() => prepareRevisionPreview({ document, repositoryRevision: 0, surfaceId: 'removed' })).toThrow('does not exist')
  })

  it('resolves URL resources into the selected preview without changing the persisted project', async () => {
    const repository = createMemoryProjectRepository()
    const document = createStudioProject({ id: 'image-preview', name: 'Image', preset: 'element-plus' })
    document.resources.logo = { id: 'logo', kind: 'url', name: 'Logo', url: 'https://example.com/logo.png' }
    const surface = document.surfacesById.home!
    surface.graph.nodesById.image = { id: 'image', kind: 'element', component: 'element.image', props: {}, resourceBindings: { src: { resourceId: 'logo' } } }
    surface.graph.root.push({ nodeId: 'image', placement: {} })
    await repository.create({ document, embeddedContents: [] })
    const preview = await loadRevisionPreview(repository, { projectId: document.id, repositoryRevision: 0, surfaceId: 'home' })
    expect(preview.compilation.ir.surfacesById.home!.nodesById.image!.props.src).toBe(document.resources.logo.url)
    expect((await repository.get(document.id))!.document.surfacesById.home!.graph.nodesById.image!.props).toEqual({})
    repository.close()
  })
})
