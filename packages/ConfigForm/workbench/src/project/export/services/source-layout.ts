import type { FormSettings } from '@moluoxixi/config-form-model'
import type {
  StandaloneSourceLayoutNode,
  StandaloneSourceNode,
  StandaloneSourceRegistry,
  StandaloneSourceResolvedLayout,
  StandaloneSourceResolvedLayouts,
} from '../types/source'
import { resolveConfigFormLayout, resolveConfigFormNodeSpan } from '@moluoxixi/config-form-core'
import { resolveSourceComponentDefinition } from './source-registry'

export function resolveSourceLayouts(form: FormSettings): StandaloneSourceResolvedLayouts {
  return {
    desktop: resolveConfigFormLayout(form.columns, form.fieldSpan, form.responsive, 'desktop', form.labelWidth),
    tablet: resolveConfigFormLayout(form.columns, form.fieldSpan, form.responsive, 'tablet', form.labelWidth),
    mobile: resolveConfigFormLayout(form.columns, form.fieldSpan, form.responsive, 'mobile', form.labelWidth),
  }
}

export function resolveSourceNodeSpan(node: StandaloneSourceNode, layout: StandaloneSourceResolvedLayout): number {
  return resolveConfigFormNodeSpan(typeof node.placement.span === 'number' ? node.placement.span : undefined, layout)
}

export function sourceNodeStyle(
  node: StandaloneSourceNode,
  layouts: StandaloneSourceResolvedLayouts,
): string {
  const desktop = resolveSourceNodeSpan(node, layouts.desktop)
  const tablet = resolveSourceNodeSpan(node, layouts.tablet)
  const mobile = resolveSourceNodeSpan(node, layouts.mobile)
  return [
    `--source-span-desktop: ${desktop}`,
    `--source-span-tablet: ${tablet}`,
    `--source-span-mobile: ${mobile}`,
  ].join('; ')
}

export function sourceFormStyle(layouts: StandaloneSourceResolvedLayouts, form: FormSettings): string {
  const styles = [
    `--source-columns-desktop: ${layouts.desktop.columns}`,
    `--source-columns-tablet: ${layouts.tablet.columns}`,
    `--source-columns-mobile: ${layouts.mobile.columns}`,
    `--source-label-width-desktop: ${layouts.desktop.labelWidth === undefined ? 'max-content' : `${layouts.desktop.labelWidth}px`}`,
    `--source-label-width-tablet: ${layouts.tablet.labelWidth === undefined ? 'max-content' : `${layouts.tablet.labelWidth}px`}`,
    `--source-label-width-mobile: ${layouts.mobile.labelWidth === undefined ? 'max-content' : `${layouts.mobile.labelWidth}px`}`,
    `gap: ${form.gap ?? '16px'}`,
  ]
  return styles.join('; ')
}

export function sourceContainerStyle(
  node: StandaloneSourceLayoutNode,
  registry: StandaloneSourceRegistry,
): Record<string, string> {
  const render = resolveSourceComponentDefinition(node, registry).binding.render
  const numericGap = typeof node.props.gap === 'number' && Number.isFinite(node.props.gap)
    ? Math.max(0, node.props.gap)
    : 0
  if (render === 'layout-flex') {
    const direction = node.props.direction === 'column' ? 'column' : 'row'
    const justify = ['flex-start', 'center', 'flex-end', 'space-between'].includes(String(node.props.justify))
      ? String(node.props.justify)
      : 'flex-start'
    const align = ['flex-start', 'center', 'flex-end', 'stretch'].includes(String(node.props.align))
      ? String(node.props.align)
      : 'stretch'
    return {
      alignItems: align,
      display: 'flex',
      flexDirection: direction,
      flexWrap: node.props.wrap === false ? 'nowrap' : 'wrap',
      gap: `${numericGap}px`,
      justifyContent: justify,
    }
  }
  if (render === 'layout-grid') {
    const columns = typeof node.props.columns === 'number' && Number.isInteger(node.props.columns)
      ? Math.min(12, Math.max(1, node.props.columns))
      : 1
    return {
      display: 'grid',
      gap: `${numericGap}px`,
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    }
  }
  return {}
}
