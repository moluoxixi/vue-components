import type { VisualStyleGroup } from '../types'

export const VISUAL_STYLE_COLOR_OPTIONS = [
  { key: 'primary', label: 'Primary', value: 'var(--demo-color-primary, #2563EB)' },
  { key: 'text', label: 'Text', value: 'var(--demo-color-text, #1F2937)' },
  { key: 'surface', label: 'Surface', value: 'var(--demo-color-surface, #FFFFFF)' },
  { key: 'border', label: 'Border', value: 'var(--demo-color-border, #D5DCE5)' },
  { key: 'transparent', label: 'Transparent', value: 'transparent' },
] as const

export const VISUAL_STYLE_GROUPS: readonly VisualStyleGroup[] = [
  { key: 'size', label: 'Size', fields: [
    { key: 'width', label: 'Width', control: 'length', allowAuto: true },
    { key: 'height', label: 'Height', control: 'length', allowAuto: true },
    { key: 'minWidth', label: 'Min. width', control: 'length' },
    { key: 'maxWidth', label: 'Max. width', control: 'length' },
  ] },
  { key: 'spacing', label: 'Spacing', fields: [
    { key: 'padding', label: 'Padding', control: 'length' },
    { key: 'margin', label: 'Margin', control: 'length', allowAuto: true, allowNegative: true },
  ] },
  { key: 'appearance', label: 'Appearance', fields: [
    { key: 'backgroundColor', label: 'Fill', control: 'color' },
    { key: 'color', label: 'Text color', control: 'color' },
    { key: 'borderWidth', label: 'Border width', control: 'length', allowPercentage: false },
    { key: 'borderStyle', label: 'Border style', control: 'select', options: [
      { value: 'none', label: 'None' },
      { value: 'solid', label: 'Solid' },
      { value: 'dashed', label: 'Dashed' },
      { value: 'dotted', label: 'Dotted' },
    ] },
    { key: 'borderColor', label: 'Border color', control: 'color' },
    { key: 'borderRadius', label: 'Corner radius', control: 'length' },
  ] },
  { key: 'typography', label: 'Typography', fields: [
    { key: 'fontSize', label: 'Font size', control: 'length' },
    { key: 'fontWeight', label: 'Font weight', control: 'select', options: [
      { value: '400', label: 'Regular' },
      { value: '500', label: 'Medium' },
      { value: '600', label: 'Semibold' },
      { value: '700', label: 'Bold' },
    ] },
    { key: 'textAlign', label: 'Text alignment', control: 'select', options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
      { value: 'justify', label: 'Justify' },
    ] },
  ] },
]

export const VISUAL_STYLE_ALIASES = new Set(VISUAL_STYLE_GROUPS.flatMap(group => group.fields.flatMap((field) => {
  const alias = field.key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
  return alias === field.key ? [] : [alias]
})))
