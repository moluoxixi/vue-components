// @vitest-environment happy-dom

import type { BuildExportSnapshotInput } from '../../../project'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { ConfigFormSourceViewer } from '@moluoxixi/config-form-source/viewer'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { SourceWorkspace } from '..'
import { loadWorkbenchAdapter } from '../../../adapters'
import { createBuiltInProjectFixture } from '../../../project/__tests__/fixtures'

async function createInput(): Promise<BuildExportSnapshotInput> {
  const adapter = await loadWorkbenchAdapter('element-plus')
  const project = createBuiltInProjectFixture('element-profile', {
    id: 'export-dialog-project',
    name: 'Export dialog project',
  }, adapter.componentRegistry.lock)
  const compiled = compileCanonicalProject({
    snapshot: createProjectSnapshot(project, 7),
    registry: adapter.registrySnapshot,
  })
  if (!compiled.success)
    throw new Error(compiled.diagnostics[0]?.message ?? 'Compilation failed.')
  return {
    bindingResolver: adapter.sourceBindingResolver,
    compilation: compiled.compilation,
    componentResolver: adapter.sourceComponentResolver,
    resourceReader: {
      async readEmbedded() {
        return { success: true, data: new Uint8Array(), diagnostics: [] }
      },
    },
  }
}

describe('source workspace', () => {
  it('captures one complete Source and Config snapshot in source mode', async () => {
    const input = await createInput()
    const target = document.createElement('main')
    target.id = 'workbench-overlays'
    target.className = 'workbench-overlays'
    target.dataset.theme = 'light'
    document.body.append(target)
    const wrapper = mount(SourceWorkspace, {
      attachTo: target,
      props: {
        capture: () => input,
        currentCompilation: input.compilation,
        mode: 'source',
        surfaceId: input.compilation.ir.surfaceOrder[0],
        theme: 'light',
      },
      global: {
        stubs: { SourceTextViewer: true },
      },
    })
    const root = new DOMWrapper(target)

    await flushPromises()

    expect(root.get('[role="tree"]').text()).toContain('package.json')
    expect(root.get('[role="tree"]').text()).toContain('index.vue')
    expect(root.get('.source-workspace__heading h2').text()).toBe('Raw Vue source')
    expect(root.get('.source-workspace__project').text()).toContain('Export dialog project')
    const viewer = wrapper.findComponent(ConfigFormSourceViewer)
    expect(viewer.props('wrapLines')).toBe(true)
    await root.get('button[aria-label="Wrap long lines"]').trigger('click')
    expect(viewer.props('wrapLines')).toBe(false)
    const rawFiles = viewer.props('files') as { entry: string, files: readonly { path: string, content?: string }[] }
    expect(rawFiles.entry).toBe('src/main.ts')
    expect(viewer.props('selectedPath')).toBe('src/views/home/index.vue')
    expect(rawFiles.files.some(file => file.path === 'src/router/index.ts')).toBe(true)
    expect(rawFiles.files.some(file => file.path.startsWith('src/views/') && file.path.endsWith('/index.vue'))).toBe(true)
    expect(rawFiles.files.some(file => file.path.startsWith('shared/') || file.path.startsWith('views/'))).toBe(false)
    expect(rawFiles.files.find(file => file.path === 'src/main.ts')?.content).toContain('@/router')
    expect(rawFiles.files.some(file => file.path === 'export-manifest.json')).toBe(false)
    expect(root.find('button.source-workspace__refresh').exists()).toBe(true)
    expect(root.findAll('.source-workspace__style-target .el-segmented__item')).toHaveLength(2)
    expect(root.get('.source-workspace__style-target').text()).toContain('CSS')
    expect(root.get('.source-workspace__style-target').text()).toContain('Tailwind v4')
    expect(root.text()).toContain('Snapshot model revision 7')
    expect(root.get('button.source-workspace__download-project').attributes('disabled')).toBeUndefined()

    await viewer.vm.$emit('update:selectedPath', 'src/router/index.ts')
    await flushPromises()
    await root.get('button.source-workspace__refresh').trigger('click')
    await flushPromises()
    expect(viewer.props('selectedPath')).toBe('src/router/index.ts')

    await wrapper.setProps({ mode: 'config' })
    await flushPromises()
    expect(root.get('.source-workspace__heading h2').text()).toBe('ConfigForm binding source')
    expect(viewer.props('selectedPath')).toBe('src/bindings.ts')
    expect(root.get('[role="tree"]').text()).toContain('config.ts')
    expect(root.get('[role="tree"]').text()).toContain('package.json')
    expect(root.find('.config-json-view').exists()).toBe(false)
    expect(root.find('.config-json-scope').exists()).toBe(false)
    expect(root.find('.config-view-tabs').exists()).toBe(false)

    wrapper.unmount()
    target.remove()
  })

  it('regenerates both outputs with a session-only Tailwind v4 target', async () => {
    const input = await createInput()
    let captureCalls = 0
    const target = document.createElement('main')
    target.id = 'workbench-overlays'
    document.body.append(target)
    const wrapper = mount(SourceWorkspace, {
      attachTo: target,
      props: {
        capture: () => {
          captureCalls += 1
          return input
        },
        currentCompilation: input.compilation,
        mode: 'source',
        theme: 'light',
      },
      global: { stubs: { SourceTextViewer: true } },
    })
    const root = new DOMWrapper(target)
    await flushPromises()
    expect(captureCalls).toBe(1)

    const targetOptions = root.findAll('.source-workspace__style-target .el-segmented__item')
    await targetOptions[1]!.trigger('click')
    await flushPromises()
    expect(captureCalls).toBe(1)

    const viewer = wrapper.findComponent(ConfigFormSourceViewer)
    const rawFiles = viewer.props('files') as { files: readonly { kind: string, path: string, content?: string }[] }
    const rawManifest = rawFiles.files.find(file => file.path === 'package.json')
    expect(rawManifest?.content).toContain('"@tailwindcss/vite": "^4.1.13"')
    expect('styleTarget' in input.compilation.snapshot.document).toBe(false)

    await wrapper.setProps({ mode: 'config' })
    await flushPromises()
    const bindingFiles = viewer.props('files') as { files: readonly { kind: string, path: string, content?: string }[] }
    const bindingManifest = bindingFiles.files.find(file => file.path === 'package.json')
    expect(bindingManifest?.content).toContain('"tailwindcss": "^4.1.13"')

    wrapper.unmount()
    target.remove()
  })

  it('shows diagnostics only for the failed output mode', async () => {
    const input = await createInput()
    const resolveConfigFormBinding = input.bindingResolver.resolveConfigFormBinding
    let bindingAvailable = false
    const capture = {
      ...input,
      bindingResolver: {
        resolveConfigFormBinding: () => bindingAvailable
          ? resolveConfigFormBinding()
          : { success: false as const, reason: 'binding unavailable' },
      },
    }
    const target = document.createElement('main')
    target.id = 'workbench-overlays'
    document.body.append(target)
    const wrapper = mount(SourceWorkspace, {
      attachTo: target,
      props: {
        capture: () => capture,
        currentCompilation: input.compilation,
        mode: 'source',
        theme: 'light',
      },
      global: { stubs: { SourceTextViewer: true } },
    })
    const root = new DOMWrapper(target)

    await flushPromises()
    expect(root.find('.source-workspace__diagnostic').exists()).toBe(false)
    expect(root.get('[role="tree"]').text()).toContain('index.vue')

    await wrapper.setProps({ mode: 'config' })
    await flushPromises()
    expect(root.get('.source-workspace__diagnostic').text()).toContain('binding unavailable')
    expect(root.find('[role="tree"]').exists()).toBe(false)
    expect(root.findAll('button.source-workspace__download-project').every(button => button.attributes('disabled') !== undefined)).toBe(true)

    bindingAvailable = true
    await root.get('button.source-workspace__retry').trigger('click')
    await flushPromises()
    expect(root.find('.source-workspace__diagnostic').exists()).toBe(false)
    expect(root.get('[role="tree"]').text()).toContain('config.ts')
    expect(root.get('button.source-workspace__download-project').attributes('disabled')).toBeUndefined()

    wrapper.unmount()
    target.remove()
  })

  it('keeps ConfigForm binding commands available when Raw Vue fails', async () => {
    const input = await createInput()
    const resolveComponent = input.componentResolver.resolveComponent
    let rejectNextResolution = true
    const capture = {
      ...input,
      componentResolver: {
        ...input.componentResolver,
        resolveComponent(request: Parameters<typeof resolveComponent>[0]) {
          if (rejectNextResolution) {
            rejectNextResolution = false
            return { success: false as const, reason: 'raw component unavailable' }
          }
          return resolveComponent(request)
        },
      },
    }
    const target = document.createElement('main')
    target.id = 'workbench-overlays'
    document.body.append(target)
    const wrapper = mount(SourceWorkspace, {
      attachTo: target,
      props: {
        capture: () => capture,
        currentCompilation: input.compilation,
        mode: 'source',
        theme: 'light',
      },
      global: { stubs: { SourceTextViewer: true } },
    })
    const root = new DOMWrapper(target)

    await flushPromises()
    expect(root.get('.source-workspace__diagnostic').text()).toContain('raw component unavailable')
    expect(root.find('[role="tree"]').exists()).toBe(false)
    expect(root.findAll('button.source-workspace__download-project').every(button => button.attributes('disabled') !== undefined)).toBe(true)

    await wrapper.setProps({ mode: 'config' })
    await flushPromises()
    expect(root.find('.source-workspace__diagnostic').exists()).toBe(false)
    expect(root.get('[role="tree"]').text()).toContain('config.ts')
    expect(root.get('button.source-workspace__download-project').attributes('disabled')).toBeUndefined()

    wrapper.unmount()
    target.remove()
  })
})
