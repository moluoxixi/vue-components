<script setup lang="ts">
import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form-headless'
import type { FormSettings } from '@moluoxixi/config-form-model'
import type {
  ConfigFormBreakpoint,
  ConfigFormResponsiveLayout,
  ConfigFormResponsiveLayoutOverride,
} from '@moluoxixi/config-form'
import type { Component } from 'vue'
import type {
  DesignerPropertyControlRegistry,
  DesignerPropertySetterDefinition,
} from '../../../registry'
import type { DesignerPropertyFormEntry } from '../types'
import { FORM_LABEL_WIDTH_MAX_PX } from '@moluoxixi/config-form-model'
import { Monitor, Smartphone, Tablet } from '@lucide/vue'
import { resolveConfigFormLayout } from '@moluoxixi/config-form'
import { computed } from 'vue'
import { resolveInspectorGridFraction } from '../../../inspector'
import { useDesignerLocale } from '../../../locale'
import DesignerBreakpointLayoutSettings from './DesignerBreakpointLayoutSettings.vue'
import './DesignerResponsiveSettings/style'

type LayoutKey = 'columns' | 'fieldSpan' | 'labelWidth'
type ResponsiveBreakpoint = Exclude<ConfigFormBreakpoint, 'desktop'>

const props = withDefaults(defineProps<{
  modelValue?: ConfigFormResponsiveLayout
  columns?: number
  components?: ConfigFormComponentRegistry
  controls?: DesignerPropertyControlRegistry
  fieldSpan?: number
  disabled?: boolean
  form?: FormSettings
  labelWidth?: number
  showHeading?: boolean
  readonly?: boolean
}>(), {
  showHeading: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: ConfigFormResponsiveLayout | undefined]
  'updateForm': [value: Partial<FormSettings>]
  commit: [value: ConfigFormResponsiveLayout | undefined]
}>()

const locale = useDesignerLocale()
const responsive = computed(() => props.modelValue ?? props.form?.responsive)
const baseColumns = computed(() => props.columns ?? props.form?.columns)
const baseFieldSpan = computed(() => props.fieldSpan ?? props.form?.fieldSpan)
const baseLabelWidth = computed(() => props.labelWidth ?? props.form?.labelWidth)
const isReadonly = computed(() => props.disabled || props.readonly)
const breakpoints: Array<{ key: ConfigFormBreakpoint, icon: Component }> = [
  { key: 'desktop', icon: Monitor },
  { key: 'tablet', icon: Tablet },
  { key: 'mobile', icon: Smartphone },
]

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

function resolvedWidthText(breakpoint: ConfigFormBreakpoint, inherited = false): string {
  const fraction = resolvedFraction(breakpoint)
  return inherited
    ? locale.t('property.resolvedWidthInherited', 'Resolved width (inherited): {fraction}', { fraction })
    : locale.t('property.resolvedWidth', 'Resolved width: {fraction}', { fraction })
}

function resolvedWidthAria(breakpoint: ConfigFormBreakpoint, inherited = false): string {
  return locale.t('property.breakpointWidth', '{breakpoint}, {width}', {
    breakpoint: title(breakpoint),
    width: resolvedWidthText(breakpoint, inherited),
  })
}

function isEnabled(breakpoint: ConfigFormBreakpoint): boolean {
  return breakpoint === 'desktop' || responsive.value?.[breakpoint] !== undefined
}

function setter(
  breakpoint: ConfigFormBreakpoint,
  key: LayoutKey,
): DesignerPropertySetterDefinition {
  const layout = resolvedLayout(breakpoint)
  const label = key === 'columns'
    ? locale.t('property.columns', 'Columns')
    : key === 'fieldSpan'
      ? locale.t('property.fieldSpan', 'Field span')
      : `${locale.t('property.labelWidth', 'Label width')} (px)`
  return {
    key: `${breakpoint}-${key}`,
    label,
    path: breakpoint === 'desktop' ? [key] : ['responsive', breakpoint, key],
    control: 'number',
    integer: true,
    min: key === 'labelWidth' ? 0 : 1,
    max: key === 'labelWidth'
      ? FORM_LABEL_WIDTH_MAX_PX
      : key === 'fieldSpan' ? layout.columns : 24,
    step: 1,
  }
}

function entryValue(breakpoint: ConfigFormBreakpoint, key: LayoutKey): number | undefined {
  const layout = resolvedLayout(breakpoint)
  if (key === 'columns')
    return layout.columns
  if (key === 'fieldSpan')
    return layout.fieldSpan
  return layout.labelWidth
}

function entries(breakpoint: ConfigFormBreakpoint): DesignerPropertyFormEntry[] {
  return (['columns', 'fieldSpan', 'labelWidth'] as const).map(key => ({
    setter: setter(breakpoint, key),
    value: entryValue(breakpoint, key),
    ...(key === 'fieldSpan' ? { hint: resolvedFraction(breakpoint) } : {}),
  }))
}

function toggleEntry(breakpoint: ResponsiveBreakpoint): DesignerPropertyFormEntry {
  return {
    setter: {
      key: `${breakpoint}-enabled`,
      label: locale.t('property.breakpointLayout', '{breakpoint} layout', { breakpoint: title(breakpoint) }),
      path: ['responsive', breakpoint],
      control: 'boolean',
    },
    value: isEnabled(breakpoint),
  }
}

function cloneResponsive(): ConfigFormResponsiveLayout {
  return {
    ...(responsive.value?.tablet ? { tablet: { ...responsive.value.tablet } } : {}),
    ...(responsive.value?.mobile ? { mobile: { ...responsive.value.mobile } } : {}),
  }
}

function commitResponsive(value: ConfigFormResponsiveLayout | undefined): void {
  emit('update:modelValue', value)
  emit('commit', value)
  emit('updateForm', { responsive: value })
}

function toggle(breakpoint: ResponsiveBreakpoint): void {
  const next = cloneResponsive()
  if (next[breakpoint]) {
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

function commitEnabled(breakpoint: ResponsiveBreakpoint, value: unknown): void {
  if (Boolean(value) !== isEnabled(breakpoint))
    toggle(breakpoint)
}

function commitDesktop(key: LayoutKey, value: number): void {
  const layout = resolvedLayout('desktop')
  if (key === 'columns') {
    emit('updateForm', {
      columns: value,
      fieldSpan: Math.min(value, layout.fieldSpan),
    })
    return
  }
  emit('updateForm', {
    [key]: key === 'fieldSpan' ? Math.min(value, layout.columns) : value,
  })
}

function commitResponsiveValue(
  breakpoint: ResponsiveBreakpoint,
  key: LayoutKey,
  value: number,
): void {
  const next = cloneResponsive()
  const layout = resolvedLayout(breakpoint)
  const current: ConfigFormResponsiveLayoutOverride = next[breakpoint] ?? {}
  next[breakpoint] = key === 'columns'
    ? {
        ...current,
        columns: value,
        fieldSpan: Math.min(value, current.fieldSpan ?? layout.fieldSpan),
      }
    : {
        ...current,
        [key]: key === 'fieldSpan' ? Math.min(value, layout.columns) : value,
      }
  commitResponsive(next)
}

function commitValue(
  breakpoint: ConfigFormBreakpoint,
  payload: { setter: DesignerPropertySetterDefinition, value: unknown },
): void {
  if (typeof payload.value !== 'number')
    return
  const key = payload.setter.path.at(-1) as LayoutKey
  if (breakpoint === 'desktop')
    commitDesktop(key, payload.value)
  else
    commitResponsiveValue(breakpoint, key, payload.value)
}
</script>

<template>
  <section class="mx-config-form-designer__responsive-settings" :aria-label="locale.t('property.responsive', 'Responsive layout')">
    <div v-if="showHeading" class="mx-config-form-designer__responsive-heading">
      <strong>{{ locale.t('property.responsive', 'Responsive layout') }}</strong>
    </div>

    <DesignerBreakpointLayoutSettings
      v-for="breakpoint in breakpoints"
      :key="breakpoint.key"
      :base-label="breakpoint.key === 'desktop' ? locale.t('property.baseLayout', 'Base') : undefined"
      :components="components"
      :controls="controls"
      :enabled="isEnabled(breakpoint.key)"
      :entries="entries(breakpoint.key)"
      :fraction="resolvedWidthText(breakpoint.key, breakpoint.key !== 'desktop' && !isEnabled(breakpoint.key))"
      :fraction-aria="resolvedWidthAria(breakpoint.key, breakpoint.key !== 'desktop' && !isEnabled(breakpoint.key))"
      :icon="breakpoint.icon"
      :readonly="isReadonly"
      :title="title(breakpoint.key)"
      :toggle-entry="breakpoint.key === 'desktop' ? undefined : toggleEntry(breakpoint.key)"
      :data-breakpoint="breakpoint.key"
      @commit="commitValue(breakpoint.key, $event)"
      @toggle="breakpoint.key !== 'desktop' && commitEnabled(breakpoint.key, $event)"
    />
  </section>
</template>
