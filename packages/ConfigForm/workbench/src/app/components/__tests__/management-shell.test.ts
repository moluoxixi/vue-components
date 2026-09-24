// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ManagementShell from '../ManagementShell.vue'

function mountShell(active?: 'pages' | 'projects') {
  return mount(ManagementShell, {
    props: { ...(active ? { active } : {}), palette: 'ink', theme: 'dark' },
    slots: { default: '<p data-screen />' },
  })
}

describe('management shell', () => {
  it('renders both management consoles as a labelled navigation landmark', () => {
    const wrapper = mountShell('projects')

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Management')
    const tabs = wrapper.findAll('[data-management-target]')
    expect(tabs.map(tab => tab.attributes('data-management-target'))).toEqual(['projects', 'pages'])
    expect(wrapper.get('[data-management-target="projects"]').text()).toBe('Projects')
    expect(wrapper.get('[data-management-target="pages"]').text()).toBe('Page management')
    expect(wrapper.find('[data-screen]').exists()).toBe(true)
    expect(wrapper.attributes()).toMatchObject({ 'data-palette': 'ink', 'data-theme': 'dark' })
    wrapper.unmount()
  })

  it('marks the active console for assistive technology', () => {
    const wrapper = mountShell('pages')

    expect(wrapper.get('[data-management-target="pages"]').attributes('aria-current')).toBe('page')
    expect(wrapper.get('[data-management-target="projects"]').attributes('aria-current')).toBeUndefined()
    expect(wrapper.get('[data-management-target="pages"]').classes()).toContain('is-active')
    wrapper.unmount()
  })

  it('emits the chosen console instead of navigating on its own', async () => {
    const wrapper = mountShell('projects')

    await wrapper.get('[data-management-target="pages"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['pages'])

    await wrapper.get('[data-management-target="projects"]').trigger('click')
    expect(wrapper.emitted('select')?.[1]).toEqual(['projects'])
    wrapper.unmount()
  })
})
