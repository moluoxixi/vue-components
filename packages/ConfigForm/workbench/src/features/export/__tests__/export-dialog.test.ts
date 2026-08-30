// @vitest-environment happy-dom

import type { BuildExportSnapshotInput } from '../../../project'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot, migrateLegacyWorkspaceApplication } from '@moluoxixi/config-form-model'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../../adapters'
import { createBuiltInWorkspaceApplication } from '../../../project'
import ExportDialog from '../ExportDialog.vue'

async function createInput(): Promise<BuildExportSnapshotInput> {
  const adapter = await loadWorkbenchAdapter('element-plus')
  const application = createBuiltInWorkspaceApplication('element-profile', {
    createdAt: '2026-08-30T08:00:00.000Z',
    id: 'export-dialog-application',
    name: 'Export dialog application',
  })
  const migrated = migrateLegacyWorkspaceApplication(application, {
    registryLock: adapter.componentRegistry.lock,
  })
  if (!migrated.success)
    throw new Error(migrated.diagnostics[0]?.message ?? 'Migration failed.')
  const compiled = compileCanonicalProject({
    snapshot: createProjectSnapshot(migrated.data, 7),
    registry: adapter.registrySnapshot,
  })
  if (!compiled.success)
    throw new Error(compiled.diagnostics[0]?.message ?? 'Compilation failed.')
  return { compilation: compiled.compilation, resolver: adapter.sourceResolver }
}

describe('export dialog', () => {
  it('captures one complete Source and Config snapshot in source mode', async () => {
    const input = await createInput()
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

    await flushPromises()

    expect(wrapper.get('[role="tree"]').text()).toContain('package.json')
    expect(wrapper.get('[role="tree"]').text()).toContain('Page.vue')
    expect(wrapper.text()).toContain('Snapshot model revision 7')
    expect(wrapper.get('button.dialog-action').attributes('disabled')).toBeUndefined()

    await wrapper.setProps({ mode: 'config' })
    await flushPromises()
    expect(wrapper.get('[role="tree"]').text()).toContain('project.config.ts')
    expect(wrapper.get('[role="tree"]').text()).toContain('form.config.ts')

    wrapper.unmount()
  })
})
