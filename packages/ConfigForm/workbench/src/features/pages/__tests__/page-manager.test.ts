// @vitest-environment happy-dom

import type { ProjectDocument } from '@moluoxixi/config-form-model'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SurfaceManagerPage } from '..'
import {
  createProjectDocumentFixture,
  duplicateProjectSurface,
} from '../../../project/__tests__/fixtures'
import { SurfaceManager } from '../components'

function mountManager(project: ProjectDocument) {
  return mount(SurfaceManager, {
    props: {
      project,
    },
  })
}

function mountPage(project: ProjectDocument) {
  return mount(SurfaceManagerPage, {
    props: {
      palette: 'ink',
      project,
      theme: 'dark',
    },
  })
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
    expect(wrapper.find('[role="list"]').exists()).toBe(true)
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(1)
    expect(wrapper.find('input[aria-label^="Page name"]').exists()).toBe(false)
    expect(wrapper.find('input[aria-label^="Route for"]').exists()).toBe(false)

    const openLink = wrapper.get('button[aria-label="Open Fixture project in the designer"]')
    expect(openLink.text()).toBe('Fixture project')
    await openLink.trigger('click')
    expect(wrapper.emitted('openPage')?.[0]).toEqual(['home'])

    await wrapper.get('button[aria-label="Edit Fixture project"]').trigger('click')
    expect(wrapper.find('input[aria-label^="Page name"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label^="Route for"]').exists()).toBe(true)
    await wrapper.get<HTMLInputElement>('input[aria-label^="Page name"]').setValue('Home page')
    await wrapper.get('button[aria-label="Finish editing Fixture project"]').trigger('click')

    expect(wrapper.emitted('action')?.[0]).toEqual([
      { type: 'surface.rename', surfaceId: 'home', name: 'Home page' },
    ])
    expect(wrapper.find('input[aria-label^="Page name"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('cancels an edit without emitting a command', async () => {
    const wrapper = mountManager(createProjectDocumentFixture())

    await wrapper.get('button[aria-label="Edit Fixture project"]').trigger('click')
    const name = wrapper.get<HTMLInputElement>('input[aria-label^="Page name"]')
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
    const name = wrapper.get<HTMLInputElement>('input[aria-label^="Page name"]')
    await name.setValue('Home page')
    await name.trigger('blur')

    expect(wrapper.emitted('action')?.[0]).toEqual([
      { type: 'surface.rename', surfaceId: 'home', name: 'Home page' },
    ])
    expect(project.surfacesById.home!.name).toBe('Fixture project')

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

  it('makes the owning project the main heading and only browses its pages', async () => {
    const project = createProjectDocumentFixture({ name: 'Customer portal' })
    const wrapper = mountPage(project)

    expect(wrapper.get('h1').text()).toBe('Customer portal')
    expect(wrapper.find('.el-select').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Back to designer"]').exists()).toBe(false)
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(1)

    await wrapper.get('input[aria-label="Search pages"]').setValue('absent page')
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(0)
    await wrapper.get('.page-manager__breadcrumb-link').trigger('click')
    expect(wrapper.emitted('openProjects')).toHaveLength(1)
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

    expect(wrapper.get('.page-manager__preview').attributes('src')).toMatch(/^data:image\/svg\+xml/)
    await wrapper.get('button[aria-label="Export Fixture project"]').trigger('click')
    expect(wrapper.emitted('export')?.[0]).toEqual(['home'])

    await wrapper.get('button[aria-label="Open Fixture project in the designer"]').trigger('click')
    expect(wrapper.emitted('openPage')?.[0]).toEqual(['home'])

    await wrapper.get('.page-manager__breadcrumb-link').trigger('click')
    expect(wrapper.emitted('openProjects')).toHaveLength(1)
    wrapper.unmount()
  })
})
