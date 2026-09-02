import type { ProjectIdentityFactory, ProjectIdentityKind } from '../types'

let identitySequence = 0

function randomIdentity(kind: ProjectIdentityKind, source: string): string {
  const random = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const nonce = `${random}-${(++identitySequence).toString(36)}`
  const prefix = (source.trim() || kind).slice(0, Math.max(1, 127 - nonce.length))
  return `${prefix}-${nonce}`
}

export const DEFAULT_PROJECT_IDENTITY_FACTORY: ProjectIdentityFactory = Object.freeze({
  create: (kind: ProjectIdentityKind, source: string) => randomIdentity(kind, source),
})
