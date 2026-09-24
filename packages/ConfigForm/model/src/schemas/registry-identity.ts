import type { RegistryLock } from '../types'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'

export function registryLockFingerprint(components: RegistryLock['components']): string {
  const ordered = Object.fromEntries(Object.entries(components)
    .sort(([left], [right]) => left.localeCompare(right)))
  return `fnv1a:${getConfigFormJsonSemanticHash(ordered)}`
}
