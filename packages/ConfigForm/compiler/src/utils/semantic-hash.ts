import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'

export function semanticHash(value: unknown): string {
  return `fnv1a:${getConfigFormJsonSemanticHash(value)}`
}
