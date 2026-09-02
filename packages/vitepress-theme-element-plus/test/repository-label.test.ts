// @vitest-environment happy-dom

import { Cloud, CodeXml, GitBranch, GitFork, HardDrive } from '@lucide/vue'
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
  it('uses a distinct navigation icon for every supported provider', () => {
    const providers = [
      ['github', GitFork],
      ['gitlab', GitBranch],
      ['gitee', CodeXml],
      ['yunxiao', Cloud],
      ['local', HardDrive],
    ] as const

    for (const [provider, icon] of providers) {
      expect(resolveSocialLinks({
        socialLinks: [{ ariaLabel: provider, icon: provider, link: `https://${provider}.test/project` }],
      })[0]?.icon).toBe(icon)
    }
  })

  it('uses the explicit provider label for navigation and the footer', () => {
    expect(resolveSocialLinks({
      socialLinks: [{ ariaLabel: 'GitLab', icon: 'gitlab', link: 'https://gitlab.test/group/project' }],
    })).toEqual([{
      icon: GitBranch,
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
