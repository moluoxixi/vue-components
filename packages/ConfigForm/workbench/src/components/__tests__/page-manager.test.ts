// @vitest-environment happy-dom

import type { ProjectDocument } from '@moluoxixi/config-form-model'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import {
  createProjectDocumentFixture,
  duplicateProjectPage,
} from '../../project/__tests__/fixtures'
import PageManager from '../PageManager.vue'

function mountManager(project: ProjectDocument) {
  return mount(PageManager, {
    props: {
      project,
      projects: [{
        homePageId: project.homePageId,
        id: project.id,
        name: project.name,
        pageCount: project.pageOrder.length,
        registryLock: project.registryLock,
        repositoryRevision: 4,
        updatedAt: '2026-08-31T00:00:00.000Z',
      }],
    },
  })
}

describe('page manager', () => {
  it('emits page actions without mutating the project', async () => {
    const project = createProjectDocumentFixture()
    const wrapper = mountManager(project)
    const name = wrapper.get<HTMLInputElement>('input[aria-label^="Page name"]')
    await name.setValue('Home page')
    await name.trigger('blur')

    expect(wrapper.emitted('action')?.[0]).toEqual([
      { type: 'page.rename', pageId: 'home', name: 'Home page' },
    ])
    expect(project.pagesById.home!.name).toBe('Fixture project')
  })

  it('requires an explicit confirmation before deleting a page', async () => {
    const base = createProjectDocumentFixture()
    const page = base.pagesById[base.homePageId]!
    const settings = duplicateProjectPage(page, 'settings', 'Settings', '/settings')
    const project = createProjectDocumentFixture({
      pageOrder: [...base.pageOrder, settings.id],
      pagesById: { ...base.pagesById, [settings.id]: settings },
    })
    const wrapper = mountManager(project)
    await wrapper.get('button[aria-label="Delete Settings"]').trigger('click')
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)
    expect(wrapper.emitted('action')).toBeUndefined()

    await wrapper.get('[role="alertdialog"] button.is-danger').trigger('click')
    expect(wrapper.emitted('action')?.[0]).toEqual([
      { type: 'page.remove', pageId: 'settings' },
    ])
  })
})
