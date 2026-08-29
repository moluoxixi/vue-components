// @vitest-environment happy-dom

import type { WorkspaceApplication } from '../../project'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { migrateWorkspaceProjectToApplication } from '../../project'
import { createProjectFixture } from '../../project/__tests__/fixtures'
import PageManager from '../PageManager.vue'

function mountManager(application: WorkspaceApplication) {
  return mount(PageManager, {
    props: {
      application,
      applications: [{
        adapter: application.manifest.adapter,
        homePageId: application.homePageId,
        id: application.id,
        name: application.name,
        pageCount: application.pages.length,
        revision: application.revision,
        templateId: application.template.id,
        updatedAt: application.updatedAt,
      }],
    },
  })
}

describe('page manager', () => {
  it('emits page operations without mutating the application', async () => {
    const application = migrateWorkspaceProjectToApplication(createProjectFixture())
    const wrapper = mountManager(application)
    const name = wrapper.get<HTMLInputElement>('input[aria-label^="Page name"]')
    await name.setValue('Home page')
    await name.trigger('blur')

    expect(wrapper.emitted('operation')?.[0]).toEqual([
      { type: 'rename-page', pageId: 'home', name: 'Home page' },
    ])
    expect(application.pages[0]!.name).toBe('Fixture project')
  })

  it('requires an explicit confirmation before deleting a page', async () => {
    const application = migrateWorkspaceProjectToApplication(createProjectFixture())
    application.pages.push({
      ...structuredClone(application.pages[0]!),
      id: 'settings',
      model: { ...structuredClone(application.pages[0]!.model), id: 'settings', name: 'Settings' },
      name: 'Settings',
      route: '/settings',
    })
    const wrapper = mountManager(application)
    await wrapper.get('button[aria-label="Delete Settings"]').trigger('click')
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)
    expect(wrapper.emitted('operation')).toBeUndefined()

    await wrapper.get('[role="alertdialog"] button.is-danger').trigger('click')
    expect(wrapper.emitted('operation')?.[0]).toEqual([
      { type: 'remove-page', pageId: 'settings' },
    ])
  })
})
