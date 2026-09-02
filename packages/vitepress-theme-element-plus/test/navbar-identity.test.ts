import { describe, expect, it } from 'vitest'
import { resolveNavbarIdentity } from '../src/upstream/vitepress/composables/navbar-identity'

describe('documentation navbar identity', () => {
  it('uses text identity without a logo when the optional logo is omitted', () => {
    expect(resolveNavbarIdentity(undefined, 'Basic docs', 'Basic documentation')).toEqual({
      logo: '',
      siteTitle: 'Basic docs',
    })
  })

  it('normalizes a configured logo and falls back to the VitePress site title', () => {
    expect(resolveNavbarIdentity(' /logo.svg ', '', 'Basic documentation')).toEqual({
      logo: '/logo.svg',
      siteTitle: 'Basic documentation',
    })
  })
})
