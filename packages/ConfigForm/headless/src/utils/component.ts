import type { ConfigFormComponentRegistration } from '../types'

/** Distinguish registration objects from direct Vue component registrations. */
export function isConfigFormComponentRegistration<TComponent = unknown>(
  value: TComponent | ConfigFormComponentRegistration<TComponent>,
): value is ConfigFormComponentRegistration<TComponent> {
  return Boolean(
    value
    && typeof value === 'object'
    && Object.hasOwn(value, 'component'),
  )
}
