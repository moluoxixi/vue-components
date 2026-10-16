import type { DesignerPropertySetterDefinition } from '@designer/registry'
import type { ConfigFormBreakpoint, ConfigFormResponsiveLayout, ConfigFormResponsiveLayoutOverride } from '@moluoxixi/config-form-core'
import type { ConfigFormNode } from '@moluoxixi/config-form-headless'
import type { MaybeRefOrGetter } from 'vue'
import type { DesignerPropertyFormEntry, DesignerPropertyFormLayout } from '../types'
import type {
  DesignerResponsiveSettingsCallbacks,
  DesignerResponsiveSettingsOptions,
} from '../types/responsive-settings'
import { resolveInspectorGridFraction } from '@designer/inspector'
import { useDesignerLocale } from '@designer/locale'
import { Monitor, Smartphone, Tablet } from '@lucide/vue'
import { resolveConfigFormLayout } from '@moluoxixi/config-form-core'
import { FORM_LABEL_WIDTH_MAX_PX } from '@moluoxixi/config-form-model'
import { computed, markRaw, toValue } from 'vue'
import DesignerBreakpointLayoutSettings from '../components/DesignerBreakpointLayoutSettings/index.vue'
import DesignerResponsiveSettingsShell from '../components/DesignerResponsiveSettingsShell/index.vue'

type LayoutKey = 'columns' | 'fieldSpan' | 'labelWidth'
type ResponsiveBreakpoint = Exclude<ConfigFormBreakpoint, 'desktop'>

/** Projects real layout values; breakpoint enablement stays a Designer command. */
export function useDesignerResponsiveSettings(
  source: MaybeRefOrGetter<DesignerResponsiveSettingsOptions>,
  callbacks: DesignerResponsiveSettingsCallbacks,
) {
  const options = computed(() => toValue(source))
  const locale = useDesignerLocale()
  const responsive = computed(() => options.value.modelValue ?? options.value.form?.responsive)
  const baseColumns = computed(() => options.value.columns ?? options.value.form?.columns)
  const baseFieldSpan = computed(() => options.value.fieldSpan ?? options.value.form?.fieldSpan)
  const baseLabelWidth = computed(() => options.value.labelWidth ?? options.value.form?.labelWidth)
  const isReadonly = computed(() => Boolean(options.value.disabled || options.value.readonly))
  const breakpoints = [
    { key: 'desktop', icon: markRaw(Monitor) },
    { key: 'tablet', icon: markRaw(Tablet) },
    { key: 'mobile', icon: markRaw(Smartphone) },
  ] as const
  const breakpointComponent = markRaw(DesignerBreakpointLayoutSettings)
  const shellComponent = markRaw(DesignerResponsiveSettingsShell)

  function title(breakpoint: ConfigFormBreakpoint): string {
    if (breakpoint === 'desktop')
      return locale.t('breakpoint.desktop', 'Desktop')
    return breakpoint === 'tablet'
      ? locale.t('breakpoint.tablet', 'Tablet')
      : locale.t('breakpoint.mobile', 'Mobile')
  }

  function resolvedLayout(breakpoint: ConfigFormBreakpoint) {
    return resolveConfigFormLayout(
      baseColumns.value,
      baseFieldSpan.value,
      responsive.value,
      breakpoint,
      baseLabelWidth.value,
    )
  }

  function resolvedFraction(breakpoint: ConfigFormBreakpoint): string {
    const layout = resolvedLayout(breakpoint)
    return resolveInspectorGridFraction(layout.fieldSpan, layout.columns).label
  }

  function isEnabled(breakpoint: ConfigFormBreakpoint): boolean {
    return breakpoint === 'desktop' || responsive.value?.[breakpoint] !== undefined
  }

  function resolvedWidthText(breakpoint: ConfigFormBreakpoint): string {
    const fraction = resolvedFraction(breakpoint)
    return breakpoint !== 'desktop' && !isEnabled(breakpoint)
      ? locale.t('property.resolvedWidthInherited', 'Resolved width (inherited): {fraction}', { fraction })
      : locale.t('property.resolvedWidth', 'Resolved width: {fraction}', { fraction })
  }

  function setter(breakpoint: ConfigFormBreakpoint, key: LayoutKey): DesignerPropertySetterDefinition {
    const layout = resolvedLayout(breakpoint)
    return {
      key: `${breakpoint}-${key}`,
      label: key === 'columns'
        ? locale.t('property.columns', 'Columns')
        : key === 'fieldSpan'
          ? locale.t('property.fieldSpan', 'Field span')
          : `${locale.t('property.labelWidth', 'Label width')} (px)`,
      path: breakpoint === 'desktop' ? [key] : ['responsive', breakpoint, key],
      control: 'number',
      integer: true,
      min: key === 'labelWidth' ? 0 : 1,
      max: key === 'labelWidth' ? FORM_LABEL_WIDTH_MAX_PX : key === 'fieldSpan' ? layout.columns : 24,
      step: 1,
    }
  }

  function cloneResponsive(): ConfigFormResponsiveLayout {
    return {
      ...(responsive.value?.tablet ? { tablet: { ...responsive.value.tablet } } : {}),
      ...(responsive.value?.mobile ? { mobile: { ...responsive.value.mobile } } : {}),
    }
  }

  function commitResponsive(value: ConfigFormResponsiveLayout | undefined): void {
    callbacks.onCommitResponsive?.(value)
    callbacks.onUpdateForm({ responsive: value })
  }

  function toggle(breakpoint: ResponsiveBreakpoint, enabled: boolean): void {
    if (isReadonly.value || enabled === isEnabled(breakpoint))
      return
    const next = cloneResponsive()
    if (!enabled) {
      delete next[breakpoint]
    }
    else {
      const layout = resolvedLayout(breakpoint)
      next[breakpoint] = {
        columns: layout.columns,
        fieldSpan: layout.fieldSpan,
        ...(layout.labelWidth === undefined ? {} : { labelWidth: layout.labelWidth }),
      }
    }
    commitResponsive(Object.keys(next).length > 0 ? next : undefined)
  }

  function commitValue(breakpoint: ConfigFormBreakpoint, key: LayoutKey, value: unknown): void {
    if (isReadonly.value || !isEnabled(breakpoint) || typeof value !== 'number')
      return
    const layout = resolvedLayout(breakpoint)
    if (breakpoint === 'desktop') {
      callbacks.onUpdateForm(key === 'columns'
        ? { columns: value, fieldSpan: Math.min(value, layout.fieldSpan) }
        : { [key]: key === 'fieldSpan' ? Math.min(value, layout.columns) : value })
      return
    }
    const next = cloneResponsive()
    const current: ConfigFormResponsiveLayoutOverride = next[breakpoint] ?? {}
    next[breakpoint] = key === 'columns'
      ? { ...current, columns: value, fieldSpan: Math.min(value, current.fieldSpan ?? layout.fieldSpan) }
      : { ...current, [key]: key === 'fieldSpan' ? Math.min(value, layout.columns) : value }
    commitResponsive(next)
  }

  const entries = computed<DesignerPropertyFormEntry[]>(() => breakpoints.flatMap(({ key: breakpoint }) => {
    const values = resolvedLayout(breakpoint)
    return (['columns', 'fieldSpan', 'labelWidth'] as const).map(key => ({
      setter: setter(breakpoint, key),
      value: values[key],
      readonly: isReadonly.value || !isEnabled(breakpoint),
      ...(key === 'fieldSpan' ? { hint: resolvedFraction(breakpoint) } : {}),
      onCommit: (value: unknown) => commitValue(breakpoint, key, value),
    }))
  }))

  const layout: DesignerPropertyFormLayout = field => [{
    id: 'responsive-layout',
    component: shellComponent,
    props: { breakpoint: options.value.breakpoint, showHeading: options.value.showHeading ?? true },
    slots: Object.fromEntries(breakpoints.map(({ key: breakpoint, icon }) => {
      const fraction = resolvedWidthText(breakpoint)
      const node: ConfigFormNode = {
        id: `responsive-layout-${breakpoint}`,
        component: breakpointComponent,
        props: {
          'baseLabel': breakpoint === 'desktop' ? locale.t('property.baseLayout', 'Base') : undefined,
          'enabled': isEnabled(breakpoint),
          fraction,
          'fractionAria': locale.t('property.breakpointWidth', '{breakpoint}, {width}', { breakpoint: title(breakpoint), width: fraction }),
          icon,
          'commandsDisabled': isReadonly.value,
          'title': title(breakpoint),
          'toggleLabel': breakpoint === 'desktop' ? undefined : locale.t('property.breakpointLayout', '{breakpoint} layout', { breakpoint: title(breakpoint) }),
          'data-breakpoint': breakpoint,
          'onToggle': (value: boolean) => {
            if (breakpoint !== 'desktop')
              toggle(breakpoint, value)
          },
        },
        slots: { default: isEnabled(breakpoint) ? entries.value.filter(entry => entry.setter.key.startsWith(`${breakpoint}-`)).map(field) : [] },
      }
      return [breakpoint, node]
    })),
  }]

  return { entries, layout }
}
