// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import VPFooter from '../src/upstream/vitepress/components/globals/vp-footer.vue'
import { resolveSocialLinks } from '../src/upstream/vitepress/composables/social-links'

const mocks = vi.hoisted(() => ({
  theme: { value: {} as Record<string, unknown> },
}))

vi.mock('vitepress', () => ({
  useData: () => ({ theme: mocks.theme }),
  withBase: (value: string) => value,
}))

describe('repository provider labels', () => {
  it('uses the explicit provider label for navigation and the footer', () => {
    expect(resolveSocialLinks({
      socialLinks: [{ ariaLabel: 'GitLab', icon: 'github', link: 'https://gitlab.test/group/project' }],
    })).toEqual([{
      icon: undefined,
      link: 'https://gitlab.test/group/project',
      text: 'GitLab',
    }])

    mocks.theme.value = {
      repository: 'https://gitlab.test/group/project',
      repositoryLabel: 'GitLab',
    }
    const wrapper = mount(VPFooter)
    expect(wrapper.get('footer').text()).toContain('GitLab')
    expect(wrapper.get('footer').text()).not.toContain('GitHub')
    wrapper.unmount()
  })

  it('does not invent a provider-specific social link', () => {
    expect(resolveSocialLinks({})).toEqual([])

    mocks.theme.value = { repository: 'https://github.com/group/project' }
    const wrapper = mount(VPFooter)
    expect(wrapper.get('footer').text()).toContain('Repository')
    wrapper.unmount()
  })
})
