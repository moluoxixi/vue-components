// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { documentedComponentNames } from '../../.vitepress/component-manifest'
import {
  componentContributorIds,
  contributorProfiles,
} from '../../.vitepress/doc-contributors'

describe('documentation contributors', () => {
  it('covers every documented component with known contributor profiles', () => {
    expect(Object.keys(componentContributorIds).sort())
      .toEqual([...documentedComponentNames].sort())

    for (const [componentName, contributorIds] of Object.entries(componentContributorIds)) {
      expect(contributorIds, componentName).not.toHaveLength(0)
      contributorIds.forEach((id) => {
        expect(contributorProfiles[id], `${componentName}: ${id}`).toBeDefined()
      })
    }
  })
})
