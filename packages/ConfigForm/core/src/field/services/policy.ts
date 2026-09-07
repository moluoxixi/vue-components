import type { ConfigFormValidateTrigger } from '../types'

export function normalizeConfigFormValidateOn(
  input?: ConfigFormValidateTrigger | readonly ConfigFormValidateTrigger[],
): ConfigFormValidateTrigger[] {
  return [...new Set<ConfigFormValidateTrigger>([
    ...(input === undefined ? [] : typeof input === 'string' ? [input] : input),
    'submit',
  ])]
}
