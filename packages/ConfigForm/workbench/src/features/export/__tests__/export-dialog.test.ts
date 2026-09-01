// @vitest-environment happy-dom

import type { BuildExportSnapshotInput } from '../../../project'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../../adapters'
import { createBuiltInProject } from '../../../project'
import ExportDialog from '../ExportDialog.vue'

async function createInput(): Promise<BuildExportSnapshotInput> {
  const adapter = await loadWorkbenchAdapter('element-plus')
  const project = createBuiltInProject('element-profile', {
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

    wrapper.unmount()
    target.remove()
  })
})
