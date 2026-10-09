import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import { resolveConfigFormLayout, resolveConfigFormNodeSpan } from '@moluoxixi/config-form-core'

type SourceSurface = ProjectCompilation['ir']['surfacesById'][string]

function layouts(surface: SourceSurface) {
  const { columns, fieldSpan, responsive, labelWidth } = surface.form
  return (['desktop', 'tablet', 'mobile'] as const).map(breakpoint =>
    resolveConfigFormLayout(columns, fieldSpan, responsive, breakpoint, labelWidth),
  )
}

export function rawFormContentClass(surface: SourceSurface): string {
  const [desktop, tablet, mobile] = layouts(surface)
  return [
    'grid min-w-0',
    `grid-cols-${desktop!.columns}`,
    `max-[1024px]:grid-cols-${tablet!.columns}`,
    `max-[720px]:grid-cols-${mobile!.columns}`,
    surface.form.gap
      ? `gap-[${surface.form.gap.replaceAll(' ', '_')}]`
      : surface.form.density === 'compact'
        ? 'gap-2'
        : 'gap-4',
    ...(desktop!.labelWidth === undefined ? [] : [`[--field-label-width:${desktop!.labelWidth}px]`]),
    ...(tablet!.labelWidth === undefined ? [] : [`max-[1024px]:[--field-label-width:${tablet!.labelWidth}px]`]),
    ...(mobile!.labelWidth === undefined ? [] : [`max-[720px]:[--field-label-width:${mobile!.labelWidth}px]`]),
  ].join(' ')
}

export function rawFormCellClass(surface: SourceSurface, nodeId: string): string {
  if (!surface.rootIds.includes(nodeId))
    return ''
  const node = surface.nodesById[nodeId]!
  const span = typeof node.placement.props.span === 'number' ? node.placement.props.span : undefined
  const [desktop, tablet, mobile] = layouts(surface).map(layout => resolveConfigFormNodeSpan(span, layout))
  return `min-w-0 col-span-${desktop} max-[1024px]:col-span-${tablet} max-[720px]:col-span-${mobile}`
}

export function rawFormCellCssClass(surface: SourceSurface, nodeId: string): string {
  const index = surface.rootIds.indexOf(nodeId)
  return index < 0 ? '' : `demo-form-cell-${index}`
}

export function rawFormLayoutCss(surface: SourceSurface): string {
  const resolved = layouts(surface)
  const blocks = resolved.map((layout, index) => {
    const labelWidth = layout.labelWidth === undefined ? '' : ` --field-label-width: ${layout.labelWidth}px;`
    const lines = [
      `.demo-surface__content { grid-template-columns: repeat(${layout.columns}, minmax(0, 1fr));${labelWidth} }`,
    ]
    surface.rootIds.forEach((nodeId, cellIndex) => {
      const node = surface.nodesById[nodeId]!
      const span = typeof node.placement.props.span === 'number' ? node.placement.props.span : undefined
      lines.push(
        `.demo-form-cell-${cellIndex} { min-width: 0; grid-column: span ${resolveConfigFormNodeSpan(span, layout)}; }`,
      )
    })
    return index === 0
      ? lines.join('\n')
      : `@media (max-width: ${index === 1 ? 1024 : 720}px) {\n${lines.map(line => `  ${line}`).join('\n')}\n}`
  })
  blocks.unshift(
    `.demo-surface__content { gap: ${surface.form.gap ?? (surface.form.density === 'compact' ? '8px' : '16px')}; }`,
  )
  return blocks.join('\n')
}
