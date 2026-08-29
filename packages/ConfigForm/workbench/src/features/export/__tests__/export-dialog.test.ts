// @vitest-environment happy-dom

import type { WorkspaceProjectionSnapshot } from '../../../session'
import { createLowCodeComponentRegistry } from '@moluoxixi/config-form-designer'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createBuiltInWorkspaceApplication } from '../../../project'
import ExportDialog from '../ExportDialog.vue'

function createProjection(): WorkspaceProjectionSnapshot {
  const application = createBuiltInWorkspaceApplication('element-profile', {
    createdAt: '2026-08-30T08:00:00.000Z',
    id: 'export-dialog-application',
    name: 'Export dialog application',
  })
  const currentPage = application.pages[0]!
  return {
    application,
    applicationRevision: application.revision,
    currentPage,
    currentPageId: currentPage.id,
    modelRevision: 7,
    revisionKey: `${application.id}:${application.revision}:${currentPage.id}:7`,
  }
}

describe('export dialog', () => {
  it('captures a complete Source snapshot when first mounted in source mode', async () => {
    const projection = createProjection()
    const wrapper = mount(ExportDialog, {
      props: {
        capture: () => projection,
        currentRevisionKey: projection.revisionKey,
        mode: 'source',
        registry: createLowCodeComponentRegistry(createElementPlusDesignerRegistry()),
        theme: 'light',
      },
      global: {
        stubs: {
          WorkspaceCodeEditor: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[role="tree"]').text()).toContain('package.json')
    expect(wrapper.text()).toContain('Snapshot model revision 7')
    expect(wrapper.get('button.dialog-action').attributes('disabled')).toBeUndefined()

    wrapper.unmount()
  })
})
