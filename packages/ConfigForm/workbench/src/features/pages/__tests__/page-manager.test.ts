// @vitest-environment happy-dom

import type { ProjectDocument } from '@moluoxixi/config-form-model'
import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SurfaceManagerPage } from '..'
import {
  createProjectDocumentFixture,
  duplicateProjectSurface,
} from '../../../project/__tests__/fixtures'
import { SurfaceManager } from '../components'

function projectSummary(project: ProjectDocument) {
  return {
    homeSurfaceId: project.homeSurfaceId,
    id: project.id,
    name: project.name,
    surfaceCount: project.surfaceOrder.length,
    datasetCount: project.datasetOrder.length,
    resourceCount: Object.keys(project.resources).length,
    registryLock: project.registryLock,
    repositoryRevision: 4,
    updatedAt: '2026-08-31T00:00:00.000Z',
  }
}

function mountManager(project: ProjectDocument) {
  return mount(SurfaceManager, {
    props: {
      project,
      projects: [projectSummary(project)],
    },
  })
}

function mountPage(project: ProjectDocument) {
  return mount(SurfaceManagerPage, {
    props: {
      palette: 'ink',
      project,
      projects: [projectSummary(project)],
      theme: 'dark',
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

  it('keeps rows read-only until a row is explicitly edited', async () => {
    const wrapper = mountManager(createProjectDocumentFixture())

    // Browsing state: the page name is the link, there is no route column, and no
    // field is editable.
    expect(wrapper.findAll('[role="columnheader"]').map(header => header.text()))
      .toEqual(['Surface', 'Actions'])
    expect(wrapper.find('input[aria-label^="Surface name"]').exists()).toBe(false)
    expect(wrapper.find('input[aria-label^="Route for"]').exists()).toBe(false)

    const openLink = wrapper.get('button[aria-label="Open Fixture project in the designer"]')
    expect(openLink.text()).toBe('Fixture project')
    await openLink.trigger('click')
    expect(wrapper.emitted('openPage')?.[0]).toEqual(['home'])

    await wrapper.get('button[aria-label="Edit Fixture project"]').trigger('click')
    expect(wrapper.find('input[aria-label^="Surface name"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label^="Route for"]').exists()).toBe(true)
    await wrapper.get<HTMLInputElement>('input[aria-label^="Surface name"]').setValue('Home page')
    await wrapper.get('button[aria-label="Finish editing Fixture project"]').trigger('click')

    expect(wrapper.emitted('action')?.[0]).toEqual([
      { type: 'surface.rename', surfaceId: 'home', name: 'Home page' },
    ])
    expect(wrapper.find('input[aria-label^="Surface name"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('cancels an edit without emitting a command', async () => {
    const wrapper = mountManager(createProjectDocumentFixture())

    await wrapper.get('button[aria-label="Edit Fixture project"]').trigger('click')
    const name = wrapper.get<HTMLInputElement>('input[aria-label^="Surface name"]')
    await name.setValue('Discarded name')
    await name.trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('action')).toBeUndefined()
    expect(wrapper.get('button[aria-label="Open Fixture project in the designer"]').text())
      .toBe('Fixture project')
    wrapper.unmount()
  })

  it('emits page actions without mutating the project', async () => {
    const project = createProjectDocumentFixture()
    const wrapper = mountManager(project)

    await wrapper.get('button[aria-label="Edit Fixture project"]').trigger('click')
    const name = wrapper.get<HTMLInputElement>('input[aria-label^="Surface name"]')
    await name.setValue('Home page')
    await name.trigger('blur')

    expect(wrapper.emitted('action')?.[0]).toEqual([
      { type: 'surface.rename', surfaceId: 'home', name: 'Home page' },
    ])
    expect(project.surfacesById.home!.name).toBe('Fixture project')

    await wrapper.get('.el-select__wrapper').trigger('click')
    expect(overlayRoot().find('.el-select-dropdown').exists()).toBe(true)
    wrapper.unmount()
  })

  it('requires an explicit confirmation before deleting a page', async () => {
    const base = createProjectDocumentFixture()
    const page = base.surfacesById[base.homeSurfaceId]!
    const settings = duplicateProjectSurface(page, 'settings', 'Settings', '/settings')
    const project = createProjectDocumentFixture({
      surfaceOrder: [...base.surfaceOrder, settings.id],
      surfacesById: { ...base.surfacesById, [settings.id]: settings },
    })
    const wrapper = mountManager(project)
    await wrapper.get('button[aria-label="Delete Settings"]').trigger('click')
    expect(wrapper.find('.page-manager__confirm[role="alert"]').exists()).toBe(true)
    expect(wrapper.emitted('action')).toBeUndefined()

    await wrapper.get('.page-manager__confirm button.is-danger').trigger('click')
    expect(wrapper.emitted('action')?.[0]).toEqual([
      { type: 'surface.remove', surfaceId: 'settings' },
    ])
    wrapper.unmount()
  })

  it('only creates pages here, because projects belong to project management', async () => {
    const wrapper = mountManager(createProjectDocumentFixture())

    await wrapper.get('[data-create-trigger="page-manager-new-surface"]').trigger('click')
    expect(wrapper.emitted('createSurface')).toHaveLength(1)

    // Creating a project is a project-management action; page management must not
    // offer a second entry for it.
    expect(wrapper.text()).not.toContain('New project')
    expect(wrapper.find('[data-create-trigger="page-manager-new-project"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders page management as a routed screen carrying the shell appearance tokens', async () => {
    const wrapper = mountPage(createProjectDocumentFixture())

    const root = wrapper.get('.page-manager-page')
    expect(root.attributes('data-theme')).toBe('dark')
    expect(root.attributes('data-palette')).toBe('ink')
    expect(root.attributes('aria-label')).toBe('Page management')
    expect(wrapper.find('.page-manager').exists()).toBe(true)
    expect(wrapper.find('.el-dialog').exists()).toBe(false)

    await wrapper.get('[data-create-trigger="page-manager-new-surface"]').trigger('click')
    expect(wrapper.emitted('createSurface')).toHaveLength(1)
    wrapper.unmount()
  })

  it('links each row to its form designer and links back to project management', async () => {
    const wrapper = mountPage(createProjectDocumentFixture())

    await wrapper.get('button[aria-label="Open Fixture project in the designer"]').trigger('click')
    expect(wrapper.emitted('openPage')?.[0]).toEqual(['home'])

    await wrapper.get('.page-manager__breadcrumb-link').trigger('click')
    expect(wrapper.emitted('openProjects')).toHaveLength(1)
    wrapper.unmount()
  })
})
