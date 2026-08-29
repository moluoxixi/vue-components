export * from './src/flow/hash'
export * from './src/flow/interpreter'
export * from './src/flow/plan'
export type * from './src/flow/types'
export * from './src/module-registry'
export * from './src/reaction'
export * from './src/reaction-config'
export type * from './src/types'

/** Identity helper used by the read-only Config projection. */
export function defineFlow<T extends import('./src/flow/types').ConfigFormFlow>(flow: T): T {
  return flow
}
