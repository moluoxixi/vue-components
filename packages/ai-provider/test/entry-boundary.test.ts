import { describe, expect, it } from 'vitest'
import * as shared from '../shared'

describe('browser-safe shared entry', () => {
  it('does not expose server config or transport functions', () => {
    expect(shared).toHaveProperty('AiProviderError')
    expect(shared).not.toHaveProperty('loadProviderConfig')
    expect(shared).not.toHaveProperty('providerStatusOf')
    expect(shared).not.toHaveProperty('streamChat')
    expect(shared).not.toHaveProperty('embed')
  })
})
