import type { DeepReadonly, ProjectTheme } from '@moluoxixi/config-form-model'
import { cloneWorkbenchJson } from '../../../utils'

export const DEFAULT_PROJECT_THEME: ProjectTheme = {
  version: 1,
  colors: {
    primary: '#2563EB',
    success: '#15803D',
    warning: '#B45309',
    danger: '#DC2626',
    text: '#1F2937',
    textMuted: '#64748B',
    canvas: '#F4F6F8',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    border: '#D5DCE5',
  },
  typography: {
    family: 'system',
    baseSize: 16,
    lineHeight: 1.5,
    bodyWeight: 400,
    headingWeight: 700,
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  border: { width: 1, style: 'solid' },
  radius: { sm: 4, md: 8, lg: 12 },
  shadows: {
    sm: { x: 0, y: 1, blur: 3, spread: 0, color: '#0000001A' },
    md: { x: 0, y: 8, blur: 24, spread: 0, color: '#0000001F' },
    lg: { x: 0, y: 18, blur: 48, spread: 0, color: '#00000024' },
  },
}

export function expandProjectTheme(theme: DeepReadonly<ProjectTheme>): ProjectTheme {
  return {
    version: 1,
    colors: { ...DEFAULT_PROJECT_THEME.colors, ...theme.colors },
    typography: { ...DEFAULT_PROJECT_THEME.typography, ...theme.typography },
    spacing: { ...DEFAULT_PROJECT_THEME.spacing, ...theme.spacing },
    border: { ...DEFAULT_PROJECT_THEME.border, ...theme.border },
    radius: { ...DEFAULT_PROJECT_THEME.radius, ...theme.radius },
    shadows: {
      ...cloneWorkbenchJson(DEFAULT_PROJECT_THEME.shadows),
      ...cloneWorkbenchJson(theme.shadows ?? {}),
    },
  }
}
