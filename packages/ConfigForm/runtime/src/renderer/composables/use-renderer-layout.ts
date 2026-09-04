import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type {
  ConfigFormBreakpoint,
  ConfigFormRendererProps,
  ConfigFormResolvedLayout,
} from '../types'
import type { RendererLayoutState } from '../types/internal'
import { computed } from 'vue'
import { resolveLabelWidth } from '../../utils'
import { resolveConfigFormLayout } from '../utils'

type ResponsiveLayouts = Record<ConfigFormBreakpoint, ConfigFormResolvedLayout>
type ResponsiveLabelWidths = Record<ConfigFormBreakpoint, string>

export function useRendererLayout<TValues extends ConfigFormValues>(
  props: Readonly<ConfigFormRendererProps<TValues>>,
): RendererLayoutState {
  const responsiveLayouts = computed<ResponsiveLayouts>(() => ({
    desktop: resolveConfigFormLayout(props.columns, props.fieldSpan, props.responsive, 'desktop', typeof props.labelWidth === 'number' ? props.labelWidth : undefined),
    tablet: resolveConfigFormLayout(props.columns, props.fieldSpan, props.responsive, 'tablet', typeof props.labelWidth === 'number' ? props.labelWidth : undefined),
    mobile: resolveConfigFormLayout(props.columns, props.fieldSpan, props.responsive, 'mobile', typeof props.labelWidth === 'number' ? props.labelWidth : undefined),
  }))
  const responsiveLabelWidths = computed<ResponsiveLabelWidths>(() => {
    const desktop = resolveLabelWidth(props.labelWidth) ?? 'max-content'
    const tablet = resolveLabelWidth(props.responsive?.tablet?.labelWidth) ?? desktop
    return {
      desktop,
      tablet,
      mobile: resolveLabelWidth(props.responsive?.mobile?.labelWidth) ?? tablet,
    }
  })
  const activePresentationLayout = computed(() => (
    props.breakpoint ? responsiveLayouts.value[props.breakpoint] : undefined
  ))

  return {
    activePresentationLayout,
    responsiveLabelWidths,
    responsiveLayouts,
  }
}
