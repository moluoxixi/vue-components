export type ConfigFormBreakpoint = 'desktop' | 'tablet' | 'mobile'

export interface ConfigFormResponsiveLayoutOverride {
  columns?: number
  fieldSpan?: number
}

export interface ConfigFormResponsiveLayout {
  tablet?: ConfigFormResponsiveLayoutOverride
  mobile?: ConfigFormResponsiveLayoutOverride
}

export interface ConfigFormResolvedLayout {
  columns: number
  fieldSpan: number
}

export function resolveConfigFormLayout(
  columns = 24,
  fieldSpan = 24,
  responsive: ConfigFormResponsiveLayout | undefined,
  breakpoint: ConfigFormBreakpoint,
): ConfigFormResolvedLayout {
  const base = {
    columns: normalizeLayoutValue(columns, 24),
    fieldSpan: normalizeLayoutValue(fieldSpan, 24),
  }
  if (breakpoint === 'desktop')
    return clampResolvedLayout(base)

  const tablet = applyOverride(base, responsive?.tablet)
  if (breakpoint === 'tablet')
    return clampResolvedLayout(tablet)

  return clampResolvedLayout(applyOverride(tablet, responsive?.mobile))
}

function applyOverride(
  current: ConfigFormResolvedLayout,
  override: ConfigFormResponsiveLayoutOverride | undefined,
): ConfigFormResolvedLayout {
  return {
    columns: normalizeLayoutValue(override?.columns, current.columns),
    fieldSpan: normalizeLayoutValue(override?.fieldSpan, current.fieldSpan),
  }
}

function clampResolvedLayout(layout: ConfigFormResolvedLayout): ConfigFormResolvedLayout {
  return {
    columns: layout.columns,
    fieldSpan: Math.min(layout.columns, layout.fieldSpan),
  }
}

function normalizeLayoutValue(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : fallback
}
