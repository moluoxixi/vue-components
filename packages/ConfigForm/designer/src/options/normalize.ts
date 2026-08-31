import type {
  DesignerOption,
  DesignerOptionSource,
  DesignerResolvedOptionState,
} from './types'
import { isDesignerJsonObject } from '../graph'

export function readDesignerOptionSource(value: unknown): DesignerOptionSource | undefined {
  if (!isRecord(value) || typeof value.kind !== 'string')
    return undefined
  if (value.kind === 'static')
    return { kind: 'static' }
  if ((value.kind !== 'dictionary' && value.kind !== 'provider') || typeof value.key !== 'string' || value.key.length === 0)
    return undefined
  if (value.kind === 'dictionary')
    return { kind: value.kind, key: value.key }
  if (value.params === undefined)
    return { kind: value.kind, key: value.key }
  if (isDesignerJsonObject(value.params))
    return { kind: value.kind, key: value.key, params: value.params }
  return undefined
}

export function normalizeDesignerOptions(
  options: readonly unknown[] | undefined,
): DesignerOption[] {
  if (!options)
    return []
  return options.flatMap((option) => {
    if (!isRecord(option) || typeof option.label !== 'string' || !isDesignerOptionValue(option.value))
      return []
    return [{
      label: option.label,
      value: option.value,
      ...(typeof option.disabled === 'boolean' ? { disabled: option.disabled } : {}),
    }]
  })
}

export function createDesignerOptionSourceCacheKey(source: DesignerOptionSource): string {
  return source.kind === 'provider'
    ? `${source.kind}:${source.key}:${JSON.stringify(source.params ?? null)}`
    : source.kind === 'dictionary'
      ? `${source.kind}:${source.key}`
      : source.kind
}

export function cloneDesignerResolvedOptionState(
  state: DesignerResolvedOptionState,
): DesignerResolvedOptionState {
  return {
    ...state,
    options: state.options.map(option => ({ ...option })),
  }
}

export function createMissingDesignerOptionSourceState(
  kind: 'dictionary' | 'provider',
  key: string,
  fallback: readonly DesignerOption[],
): DesignerResolvedOptionState {
  return {
    status: 'error',
    options: fallback.map(option => ({ ...option })),
    error: `Unknown option ${kind}: ${key}`,
  }
}

export function createDesignerOptionKey(
  value: DesignerOption['value'],
  index: number,
): string {
  return `${typeof value}:${String(value)}:${index}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDesignerOptionValue(value: unknown): value is DesignerOption['value'] {
  return typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
}
