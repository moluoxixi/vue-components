import type {
  DesignerOption,
  DesignerOptionSource,
  DesignerResolvedOptionState,
} from '../types'

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
  staticOptions: readonly DesignerOption[],
): DesignerResolvedOptionState {
  return {
    status: 'error',
    options: staticOptions.map(option => ({ ...option })),
    error: `Unknown option ${kind}: ${key}`,
  }
}

export function createDesignerOptionKey(
  value: DesignerOption['value'],
  index: number,
): string {
  return `${typeof value}:${String(value)}:${index}`
}
