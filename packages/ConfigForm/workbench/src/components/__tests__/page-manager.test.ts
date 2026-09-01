// @vitest-environment happy-dom

import type { ProjectDocument } from '@moluoxixi/config-form-model'
import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

function overlayRoot(): DOMWrapper<Element> {
  return new DOMWrapper(document.getElementById('workbench-overlays')!)
}

describe('page manager', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="workbench-overlays" class="workbench-overlays" data-theme="dark"></div>'
  })

  afterEach(() => document.body.replaceChildren())

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

    await wrapper.get('.el-select__wrapper').trigger('click')
    expect(overlayRoot().find('.el-select-dropdown').exists()).toBe(true)
    wrapper.unmount()
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
    expect(wrapper.find('.page-manager__confirm[role="alert"]').exists()).toBe(true)
    expect(wrapper.emitted('action')).toBeUndefined()

    await wrapper.get('.page-manager__confirm button.is-danger').trigger('click')
    expect(wrapper.emitted('action')?.[0]).toEqual([
      { type: 'page.remove', pageId: 'settings' },
    ])
    wrapper.unmount()
  })

  it('emits explicit project and page creation targets', async () => {
    const wrapper = mountManager(createProjectDocumentFixture())
    await wrapper.get('[data-create-trigger="page-manager-new-project"]').trigger('click')
    await wrapper.get('[data-create-trigger="page-manager-new-page"]').trigger('click')

    expect(wrapper.emitted('createProject')).toHaveLength(1)
    expect(wrapper.emitted('createPage')).toHaveLength(1)
    wrapper.unmount()
  })
})
