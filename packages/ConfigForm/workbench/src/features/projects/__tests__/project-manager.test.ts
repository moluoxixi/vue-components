// @vitest-environment happy-dom

import type { ProjectSummary } from '@moluoxixi/config-form-model'
import type { VueWrapper } from '@vue/test-utils'
import type { ProjectManagerController } from '../types'
import { mount } from '@vue/test-utils'
import { ElSelect } from 'element-plus'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import ProjectManager from '../index.vue'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.replaceChildren()
})

function project(name: string, updatedAt: string, adapter = 'element-plus'): ProjectSummary {
  return {
    id: name,
    name,
    updatedAt,
    homeSurfaceId: 'home',
    repositoryRevision: 1,
    surfaceCount: 1,
    datasetCount: 0,
    resourceCount: 0,
    registryLock: { adapter, version: '1', fingerprint: 'test', components: {} },
  }
}

function render(projects: ProjectSummary[]) {
  document.body.innerHTML = '<div id="workbench-overlays"></div>'
  const controller = {
    projects: ref(projects),
    busy: ref(false),
    initialized: ref(true),
    currentProject: ref<{ id: string }>(),
    localeOptions: computed(() => ({ locale: 'en-US' as const })),
    readEmbeddedResource: vi.fn(),
    deleteProject: vi.fn(),
    duplicateProject: vi.fn(),
    exportProject: vi.fn(),
    exportProjectSource: vi.fn(),
    removeProjectImage: vi.fn(),
    renameProject: vi.fn(),
    setProjectImage: vi.fn(),
    requestOpenProject: vi.fn(),
  } satisfies ProjectManagerController
  const wrapper = mount(ProjectManager, {
    attachTo: document.body,
    props: { controller, ui: { message: ref(''), clearMessage: vi.fn(), paletteFamily: ref('ink'), resolvedTheme: ref('light') } },
    global: { stubs: { ElDialog: true } },
  })
  wrappers.push(wrapper)
  return { wrapper, controller }
}

describe('project discovery and opening', () => {
  it('sorts by recent updates or natural project names without rearranging the repository list', async () => {
    const projects = [project('Project 10', '2026-10-09T10:00:00Z'), project('Project 2', '2026-10-08T10:00:00Z')]
    const { wrapper, controller } = render(projects)
    expect(wrapper.findAll('[data-project-open]').map(button => button.attributes('aria-label'))).toEqual(['Project 10', 'Project 2'])
    wrapper.getComponent(ElSelect).vm.$emit('update:modelValue', 'name')
    await nextTick()
    expect(wrapper.findAll('[data-project-open]').map(button => button.attributes('aria-label'))).toEqual(['Project 2', 'Project 10'])
    expect(controller.projects.value.map(project => project.name)).toEqual(['Project 10', 'Project 2'])
  })

  it('searches readable library names and lets an empty search recover in place', async () => {
    const { wrapper } = render([project('Profile', '2026-10-09T10:00:00Z')])
    const search = wrapper.get('.project-manager__search input')
    await search.setValue('Element Plus')
    expect(wrapper.findAll('[data-project-open]')).toHaveLength(1)
    await search.setValue('missing')
    expect(wrapper.get('.project-manager__empty').text()).toContain('clear the search')
    expect(wrapper.get('.project-manager__list-heading [role="status"]').text()).toBe('0 of 1 projects')
    await wrapper.get('.project-manager__empty button').trigger('click')
    expect(wrapper.findAll('[data-project-open]')).toHaveLength(1)
    expect(document.activeElement).toBe(search.element)
  })

  it('shows progress and prevents duplicate opens until the request settles', async () => {
    const { wrapper, controller } = render([project('Profile', '2026-10-09T10:00:00Z')])
    let complete!: () => void
    controller.requestOpenProject.mockImplementation(() => new Promise<void>((resolve) => {
      complete = resolve
    }))
    const open = wrapper.get('[data-project-open]')
    await open.trigger('click')
    expect(open.attributes('aria-busy')).toBe('true')
    expect(open.attributes('disabled')).toBeDefined()
    expect(wrapper.get('.project-card__open-state').text()).toBe('Opening…')
    await open.trigger('click')
    expect(controller.requestOpenProject).toHaveBeenCalledOnce()
    controller.currentProject.value = { id: 'Profile' }
    complete()
    await nextTick()
    await nextTick()
    expect(wrapper.emitted('open')).toEqual([[]])
    expect(open.attributes('disabled')).toBeUndefined()
  })
})
