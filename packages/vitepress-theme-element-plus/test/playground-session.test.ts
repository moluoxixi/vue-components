import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consumeElementPlusDocsPlaygroundSession,
  createElementPlusDocsPlaygroundSession,
} from '../index'

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    values,
  }
}

describe('playground sessions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('stores source behind an opaque token and consumes it once', () => {
    const storage = createStorage()
    const source = '<template>private source</template>'
    const token = createElementPlusDocsPlaygroundSession(source, 'demo-copy-text', storage)

    expect(token).not.toContain(source)
    expect(token).toMatch(/^[a-z0-9-]{16,64}$/i)
    expect(consumeElementPlusDocsPlaygroundSession(token, storage)).toEqual({
      demoId: 'demo-copy-text',
      source,
    })
    expect(consumeElementPlusDocsPlaygroundSession(token, storage)).toBeNull()
  })

  it('rejects malformed tokens without reading storage', () => {
    const storage = createStorage()
    expect(consumeElementPlusDocsPlaygroundSession('../source', storage)).toBeNull()
    expect(storage.getItem).not.toHaveBeenCalled()
  })

  it('removes expired and malformed payloads', () => {
    const storage = createStorage()
    const token = createElementPlusDocsPlaygroundSession('source', 'demo', storage)
    expect(consumeElementPlusDocsPlaygroundSession(token, storage, Date.now() + 31 * 60 * 1000)).toBeNull()
    expect(storage.values.size).toBe(0)

    storage.values.set('mx-docs:playground:v1:1234567890abcdef', '{broken')
    expect(consumeElementPlusDocsPlaygroundSession('1234567890abcdef', storage)).toBeNull()
    expect(storage.values.size).toBe(0)
  })
})
