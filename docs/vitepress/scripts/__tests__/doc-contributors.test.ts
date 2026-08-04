// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { documentedComponentNames } from '../../.vitepress/component-manifest'
import {
  componentContributors,
  contributorProfiles,
} from '../../.vitepress/doc-contributors'

describe('documentation contributors', () => {
  it('covers every documented component with known contributor profiles', () => {
    expect(Object.keys(componentContributors).sort())
      .toEqual([...documentedComponentNames].sort())

    for (const [componentName, contributors] of Object.entries(componentContributors)) {
      expect(contributors, componentName).not.toHaveLength(0)
      contributors.forEach((contributor) => {
        expect(contributor.contributions, componentName).toBeGreaterThan(0)
        expect(contributorProfiles[contributor.login], `${componentName}: ${contributor.login}`).toBeDefined()
      })
    }
  })

  it('stores display-safe GitHub profile fields', () => {
    for (const contributor of Object.values(contributorProfiles)) {
      expect(contributor.name).not.toBe('wl')
      expect(contributor.avatarUrl).toMatch(/^https:\/\/avatars\.githubusercontent\.com\//)
      expect(contributor.profileUrl).toBe(`https://github.com/${contributor.login}`)
      expect(contributor.repositoryContributions).toBeGreaterThan(0)
    }
  })
})
