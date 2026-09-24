import type { ProjectTheme } from '@moluoxixi/config-form-model'
import type { CSSProperties } from 'vue'

const FONT_FAMILIES: Record<NonNullable<ProjectTheme['typography']>['family'] & string, string> = {
  'system': 'system-ui, sans-serif',
  'sans-serif': 'ui-sans-serif, system-ui, sans-serif',
  'serif': 'ui-serif, Georgia, serif',
  'monospace': 'ui-monospace, SFMono-Regular, monospace',
}

function shadowValue(shadow: NonNullable<ProjectTheme['shadows']>[keyof NonNullable<ProjectTheme['shadows']>]): string {
  return shadow
    ? `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}`
    : ''
}

export function projectThemeStyle(theme: ProjectTheme | undefined): CSSProperties {
  if (!theme)
    return {}
  const properties: Record<string, string> = {}
  Object.entries(theme.colors ?? {}).forEach(([key, value]) => {
    if (value !== undefined)
      properties[`--demo-color-${key}`] = value
  })
  Object.entries(theme.spacing ?? {}).forEach(([key, value]) => {
    if (value !== undefined)
      properties[`--demo-spacing-${key}`] = `${value}px`
  })
  Object.entries(theme.radius ?? {}).forEach(([key, value]) => {
    if (value !== undefined)
      properties[`--demo-radius-${key}`] = `${value}px`
  })
  Object.entries(theme.shadows ?? {}).forEach(([key, value]) => {
    if (value)
      properties[`--demo-shadow-${key}`] = shadowValue(value)
  })
  if (theme.typography?.family)
    properties['--demo-font-family'] = FONT_FAMILIES[theme.typography.family]
  if (theme.typography?.baseSize !== undefined)
    properties['--demo-font-size'] = `${theme.typography.baseSize}px`
  if (theme.typography?.lineHeight !== undefined)
    properties['--demo-line-height'] = String(theme.typography.lineHeight)
  if (theme.typography?.bodyWeight !== undefined)
    properties['--demo-font-body-weight'] = String(theme.typography.bodyWeight)
  if (theme.typography?.headingWeight !== undefined)
    properties['--demo-font-heading-weight'] = String(theme.typography.headingWeight)
  if (theme.border?.width !== undefined)
    properties['--demo-border-width'] = `${theme.border.width}px`
  if (theme.border?.style !== undefined)
    properties['--demo-border-style'] = theme.border.style

  const primary = theme.colors?.primary
  const success = theme.colors?.success
  const warning = theme.colors?.warning
  const danger = theme.colors?.danger
  const text = theme.colors?.text
  const textMuted = theme.colors?.textMuted
  const border = theme.colors?.border
  const surface = theme.colors?.surface
  const radius = theme.radius?.md
  if (primary)
    properties['--el-color-primary'] = primary
  if (success)
    properties['--el-color-success'] = success
  if (warning)
    properties['--el-color-warning'] = warning
  if (danger)
    properties['--el-color-danger'] = danger
  if (text)
    properties['--el-text-color-primary'] = text
  if (textMuted)
    properties['--el-text-color-secondary'] = textMuted
  if (border)
    properties['--el-border-color'] = border
  if (surface)
    properties['--el-bg-color'] = surface
  if (radius !== undefined)
    properties['--el-border-radius-base'] = `${radius}px`
  return properties as CSSProperties
}
