import type {
  ConfigFormBreakpoint,
  ConfigFormResolvedLayout,
  ConfigFormResponsiveLayout,
  ConfigFormResponsiveLayoutOverride,
} from '../types'

export function resolveConfigFormNodeSpan(
  nodeSpan: number | undefined,
  layout: ConfigFormResolvedLayout,
): number {
  const span = nodeSpan ?? layout.fieldSpan
  return Math.max(1, Math.min(layout.columns, Math.floor(span)))
}

export function resolveConfigFormLayout(
  columns = 24,
  fieldSpan = 24,
  responsive: ConfigFormResponsiveLayout | undefined,
  breakpoint: ConfigFormBreakpoint,
  labelWidth?: number,
): ConfigFormResolvedLayout {
  const base = {
    columns: normalizeLayoutValue(columns, 24),
    fieldSpan: normalizeLayoutValue(fieldSpan, 24),
    labelWidth: normalizeLabelWidth(labelWidth),
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
    labelWidth: normalizeLabelWidth(override?.labelWidth, current.labelWidth),
  }
}

function clampResolvedLayout(layout: ConfigFormResolvedLayout): ConfigFormResolvedLayout {
  return {
    columns: layout.columns,
    fieldSpan: Math.min(layout.columns, layout.fieldSpan),
    ...(layout.labelWidth === undefined ? {} : { labelWidth: layout.labelWidth }),
  }
}

function normalizeLabelWidth(value: number | undefined, defaultValue?: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : defaultValue
}

function normalizeLayoutValue(value: number | undefined, defaultValue: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(24, Math.max(1, Math.floor(value)))
    : defaultValue
}
