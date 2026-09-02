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
