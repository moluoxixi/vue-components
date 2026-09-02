// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { resolveTrustedApiUrl } from '../../src/node/repository'

describe('repository API pagination trust boundary', () => {
  it('accepts configured API paths and rejects foreign origins or sibling paths', () => {
    expect(resolveTrustedApiUrl(
      'https://gitlab.test/api/v4',
      'https://gitlab.test/api/v4/projects/1?page=2',
      'GitLab',
    )).toBe('https://gitlab.test/api/v4/projects/1?page=2')

    expect(() => resolveTrustedApiUrl(
      'https://gitlab.test/api/v4',
      'https://attacker.test/collect',
      'GitLab',
    )).toThrow('GitLab pagination URL escaped the configured API base')
    expect(() => resolveTrustedApiUrl(
      'https://gitlab.test/api/v4',
      'https://gitlab.test/oauth/authorize',
      'GitLab',
    )).toThrow('GitLab pagination URL escaped the configured API base')
  })
})
