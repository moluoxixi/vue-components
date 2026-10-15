// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { discoverWorkspaceUrl } from '../services/workspace-repository'

describe('workspace connection discovery', () => {
  it('keeps normal browser mode local and uses same-origin metadata on the packaged designer', async () => {
    const location = { href: 'http://127.0.0.1:4332/#/projects', origin: 'http://127.0.0.1:4332' }
    expect(await discoverWorkspaceUrl(location, '')).toBeUndefined()
    expect(await discoverWorkspaceUrl(location, location.origin)).toBe(location.origin)
    await expect(discoverWorkspaceUrl(location, 'http://127.0.0.1:5000')).rejects.toThrow('origin')
  })

  it('accepts an explicit local development connection and rejects ambiguous or remote targets', async () => {
    const location = (url: string) => ({ href: `http://127.0.0.1:4331/?workspace=${encodeURIComponent(url)}#/projects`, origin: 'http://127.0.0.1:4331' })
    expect(await discoverWorkspaceUrl(location('http://localhost:4332'), '')).toBe('http://localhost:4332')
    for (const target of ['https://example.com', 'http://user:password@localhost:4332', 'http://localhost:4332/api', 'http://localhost:4332/?other=1', 'http://localhost:4332/#other']) {
      await expect(discoverWorkspaceUrl(location(target), '')).rejects.toThrow('local HTTP service origin')
    }
  })
})
