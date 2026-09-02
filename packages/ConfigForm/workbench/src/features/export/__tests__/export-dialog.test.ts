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
  return { compilation: compiled.compilation, resolver: adapter.sourceResolver }
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
        currentPageId: input.compilation.snapshot.document.homePageId,
        mode: 'source',
        theme: 'light',
      },
      global: {
        stubs: { WorkspaceCodeEditor: true },
      },
    })
    const root = new DOMWrapper(target)

    await flushPromises()

    expect(root.get('[role="tree"]').text()).toContain('package.json')
    expect(root.get('[role="tree"]').text()).toContain('Page.vue')
    expect(root.text()).toContain('Snapshot model revision 7')
    expect(root.get('button.dialog-action').attributes('disabled')).toBeUndefined()

    await wrapper.setProps({ mode: 'config' })
    await flushPromises()
    expect(root.get('[role="tree"]').text()).toContain('project.config.ts')
    expect(root.get('[role="tree"]').text()).toContain('form.config.ts')

    await root.findAll('.el-tabs__item').find(item => item.text() === 'JSON')!.trigger('click')
    await flushPromises()
    expect(root.get('.config-json-view').text()).toContain('"version": 4')
    await root.findAll('.el-segmented__item').find(item => item.text().includes('Current page'))!.trigger('click')
    await flushPromises()
    expect(root.get('.config-json-view').text()).toContain('"graph"')
    expect(root.get('.config-json-view').text()).not.toContain('"version": 4')

    await wrapper.setProps({ currentPageId: 'missing-page' })
    await flushPromises()
    expect(root.get('[role="status"]').text()).toBe('The current page is unavailable in this export snapshot.')
    expect(root.findAll('button').find(button => button.text().trim() === 'Copy')!.attributes('disabled')).toBeDefined()
    expect(root.findAll('button').find(button => button.text().trim() === 'Download')!.attributes('disabled')).toBeDefined()

    wrapper.unmount()
    target.remove()
  })
})
