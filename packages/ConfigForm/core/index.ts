export * from './src/flow/hash'
export * from './src/flow/interpreter'
export * from './src/flow/plan'
export { CONFIG_FORM_FLOW_VERSION } from './src/flow/types'
export type * from './src/flow/types'
export * from './src/json'
export * from './src/module-registry'
export * from './src/reaction'
export * from './src/reaction-config'
export type * from './src/types'

/** Identity helper used by the read-only Config projection. */
export function defineFlow<T extends import('./src/flow/types').ConfigFormFlow>(flow: T): T {
  return flow
}
