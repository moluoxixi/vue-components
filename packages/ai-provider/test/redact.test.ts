import { describe, expect, it } from 'vitest'
import { redactSensitiveText } from '../server'

describe('redactSensitiveText', () => {
  it('ignores empty secrets', () => {
    expect(redactSensitiveText('unchanged', ['', ''])).toBe('unchanged')
  })

  it('redacts raw, URI-encoded and form-encoded secret variants', () => {
    const secret = 'a b+c/d?e'
    const input = [
      secret,
      encodeURIComponent(secret),
      new URLSearchParams({ value: secret }).toString().slice('value='.length),
    ].join(' | ')
    const output = redactSensitiveText(input, [secret])

    expect(output).not.toContain(secret)
    expect(output).not.toContain(encodeURIComponent(secret))
    expect(output.match(/\[REDACTED\]/g)).toHaveLength(3)
  })

  it('matches lowercase percent escapes without changing ordinary letter case', () => {
    const secret = 'A/B C'
    const encoded = encodeURIComponent(secret).replace(/%[\dA-F]{2}/g, value => value.toLowerCase())

    expect(redactSensitiveText(encoded, [secret])).toBe('[REDACTED]')
    expect(redactSensitiveText('a/b c', [secret])).toBe('a/b c')
  })
})
