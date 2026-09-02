import type { ConfigFormFlow } from '../types'

/** Identity helper used by the read-only Config projection. */
export function defineFlow<T extends ConfigFormFlow>(flow: T): T {
  return flow
}
