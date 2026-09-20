// @vitest-environment happy-dom

import type { BuildExportSnapshotInput } from '../../../project'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ExportDialog } from '..'
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

describe('export dialog', () => {
  it('captures one complete Source and Config snapshot in source mode', async () => {
    const input = await createInput()
    const target = document.createElement('main')
    target.id = 'workbench-overlays'
    target.className = 'workbench-overlays'
    target.dataset.theme = 'light'
    document.body.append(target)
    const wrapper = mount(ExportDialog, {
      props: {
        capture: () => input,
        currentCompilation: input.compilation,
        mode: 'source',
        theme: 'light',
      },
      global: {
        stubs: { SourceTextViewer: true },
      },
    })
    const root = new DOMWrapper(target)

    await flushPromises()

    expect(root.get('[role="tree"]').text()).toContain('package.json')
    expect(root.get('[role="tree"]').text()).toContain('Surface.vue')
    expect(root.get('.export-dialog-heading h2').text()).toBe('Raw Vue source')
    expect(root.text()).toContain('Snapshot model revision 7')
    expect(root.get('button.dialog-action').attributes('disabled')).toBeUndefined()

    await wrapper.setProps({ mode: 'config' })
    await flushPromises()
    expect(root.get('.export-dialog-heading h2').text()).toBe('ConfigForm binding source')
    expect(root.get('[role="tree"]').text()).toContain('config.ts')
    expect(root.get('[role="tree"]').text()).toContain('package.json')
    expect(root.find('.config-json-view').exists()).toBe(false)
    expect(root.find('.config-json-scope').exists()).toBe(false)
    expect(root.find('.config-view-tabs').exists()).toBe(false)

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
    const wrapper = mount(ExportDialog, {
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
    expect(root.find('.export-diagnostic').exists()).toBe(false)
    expect(root.get('[role="tree"]').text()).toContain('Surface.vue')

    await wrapper.setProps({ mode: 'config' })
    await flushPromises()
    expect(root.get('.export-diagnostic').text()).toContain('binding unavailable')
    expect(root.find('[role="tree"]').exists()).toBe(false)
    expect(root.findAll('button.dialog-action').every(button => button.attributes('disabled') !== undefined)).toBe(true)

    bindingAvailable = true
    await root.get('button.export-diagnostic-refresh').trigger('click')
    await flushPromises()
    expect(root.find('.export-diagnostic').exists()).toBe(false)
    expect(root.get('[role="tree"]').text()).toContain('config.ts')
    expect(root.get('button.dialog-action').attributes('disabled')).toBeUndefined()

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
    const wrapper = mount(ExportDialog, {
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
    expect(root.get('.export-diagnostic').text()).toContain('raw component unavailable')
    expect(root.find('[role="tree"]').exists()).toBe(false)
    expect(root.findAll('button.dialog-action').every(button => button.attributes('disabled') !== undefined)).toBe(true)

    await wrapper.setProps({ mode: 'config' })
    await flushPromises()
    expect(root.find('.export-diagnostic').exists()).toBe(false)
    expect(root.get('[role="tree"]').text()).toContain('config.ts')
    expect(root.get('button.dialog-action').attributes('disabled')).toBeUndefined()

    wrapper.unmount()
    target.remove()
  })
})
