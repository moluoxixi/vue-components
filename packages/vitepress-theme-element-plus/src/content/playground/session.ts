export const elementPlusDocsPlaygroundSessionQuery = 'session'

const sessionKeyPrefix = 'mx-docs:playground:v1:'
const sessionMaxAgeMs = 30 * 60 * 1000

export interface ElementPlusDocsPlaygroundSession {
  demoId: string
  source: string
}

interface StoredPlaygroundSession extends ElementPlusDocsPlaygroundSession {
  createdAt: number
  version: 1
}

export interface ElementPlusDocsSessionStorage {
  getItem: (key: string) => string | null
  removeItem: (key: string) => void
  setItem: (key: string, value: string) => void
}

function getSessionStorage(): ElementPlusDocsSessionStorage {
  if (typeof window === 'undefined')
    throw new Error('Playground sessions are only available in the browser.')
  return window.sessionStorage
}

function createSessionToken(): string {
  if (typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function isValidToken(token: string): boolean {
  return /^[a-z0-9-]{16,64}$/i.test(token)
}

export function createElementPlusDocsPlaygroundSession(
  source: string,
  demoId: string,
  storage: ElementPlusDocsSessionStorage = getSessionStorage(),
): string {
  const token = createSessionToken()
  const value: StoredPlaygroundSession = {
    version: 1,
    createdAt: Date.now(),
    demoId,
    source,
  }
  storage.setItem(`${sessionKeyPrefix}${token}`, JSON.stringify(value))
  return token
}

export function consumeElementPlusDocsPlaygroundSession(
  token: string | null,
  storage: ElementPlusDocsSessionStorage = getSessionStorage(),
  now = Date.now(),
): ElementPlusDocsPlaygroundSession | null {
  if (!token || !isValidToken(token))
    return null

  const key = `${sessionKeyPrefix}${token}`
  const raw = storage.getItem(key)
  storage.removeItem(key)
  if (!raw)
    return null

  try {
    const value = JSON.parse(raw) as Partial<StoredPlaygroundSession>
    if (
      value.version !== 1
      || typeof value.createdAt !== 'number'
      || now - value.createdAt > sessionMaxAgeMs
      || now < value.createdAt
      || typeof value.demoId !== 'string'
      || typeof value.source !== 'string'
    ) {
      return null
    }

    return { demoId: value.demoId, source: value.source }
  }
  catch {
    return null
  }
}
