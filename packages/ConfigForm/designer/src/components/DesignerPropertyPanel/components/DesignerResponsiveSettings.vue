<script setup lang="ts">
import type {
  ConfigFormBreakpoint,
  ConfigFormResponsiveLayout,
  ConfigFormResponsiveLayoutOverride,
} from '@moluoxixi/config-form'
import type { FormSettings } from '@moluoxixi/config-form-model'
import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form-headless'
import type { DesignerPropertyControlRegistry, DesignerPropertySetterDefinition } from '../../../registry'
import type { DesignerPropertyFormEntry } from '../types'
import { Monitor, Smartphone, Tablet } from '@lucide/vue'
import { resolveConfigFormLayout } from '@moluoxixi/config-form'
import { computed } from 'vue'
import { resolveInspectorGridFraction } from '../../../inspector'
import { useDesignerLocale } from '../../../locale'
import DesignerPropertyForm from './DesignerPropertyForm.vue'
import './DesignerResponsiveSettings/style'

const props = withDefaults(defineProps<{
  modelValue?: ConfigFormResponsiveLayout
  columns?: number
  components?: ConfigFormComponentRegistry
  controls?: DesignerPropertyControlRegistry
  fieldSpan?: number
  disabled?: boolean
  showHeading?: boolean
  form?: FormSettings
  readonly?: boolean
}>(), {
  showHeading: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: ConfigFormResponsiveLayout | undefined]
  commit: [value: ConfigFormResponsiveLayout | undefined]
}>()

const locale = useDesignerLocale()
const responsive = computed(() => props.modelValue ?? props.form?.responsive)
const baseColumns = computed(() => props.columns ?? props.form?.columns)
const baseFieldSpan = computed(() => props.fieldSpan ?? props.form?.fieldSpan)
const isReadonly = computed(() => props.disabled || props.readonly)
const breakpoints: Array<{ key: Exclude<ConfigFormBreakpoint, 'desktop'>, icon: typeof Tablet }> = [
  { key: 'tablet', icon: Tablet },
  { key: 'mobile', icon: Smartphone },
]

function title(breakpoint: Exclude<ConfigFormBreakpoint, 'desktop'>): string {
  return breakpoint === 'tablet'
    ? locale.t('breakpoint.tablet', 'Tablet')
    : locale.t('breakpoint.mobile', 'Mobile')
}

function breakpointTitle(breakpoint: ConfigFormBreakpoint): string {
  return breakpoint === 'desktop'
    ? locale.t('breakpoint.desktop', 'Desktop')
    : title(breakpoint)
}

function resolvedFraction(breakpoint: ConfigFormBreakpoint): string {
  const layout = resolveConfigFormLayout(
    baseColumns.value,
    baseFieldSpan.value,
    responsive.value,
    breakpoint,
  )
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
    breakpoint: breakpointTitle(breakpoint),
    width: resolvedWidthText(breakpoint, inherited),
  })
}

function isEnabled(breakpoint: Exclude<ConfigFormBreakpoint, 'desktop'>): boolean {
  return responsive.value?.[breakpoint] !== undefined
}

function setter(
  breakpoint: Exclude<ConfigFormBreakpoint, 'desktop'>,
  key: keyof ConfigFormResponsiveLayoutOverride,
): DesignerPropertySetterDefinition {
  const label = key === 'columns'
    ? locale.t('property.columns', 'Columns')
    : locale.t('property.fieldSpan', 'Field span')
  return {
    key: `${breakpoint}-${key}`,
    label,
    path: ['responsive', breakpoint, key],
    control: 'number',
    min: 1,
    max: 24,
    step: 1,
  }
}

function toggleEntry(breakpoint: Exclude<ConfigFormBreakpoint, 'desktop'>): DesignerPropertyFormEntry {
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

function valueEntry(
  breakpoint: Exclude<ConfigFormBreakpoint, 'desktop'>,
  key: keyof ConfigFormResponsiveLayoutOverride,
): DesignerPropertyFormEntry {
  return {
    setter: setter(breakpoint, key),
    value: responsive.value?.[breakpoint]?.[key],
    ...(key === 'fieldSpan' ? { hint: resolvedFraction(breakpoint) } : {}),
  }
}

function toggle(breakpoint: Exclude<ConfigFormBreakpoint, 'desktop'>): void {
  const next = cloneResponsive()
  if (next[breakpoint]) {
    delete next[breakpoint]
  }
  else {
    const resolved = resolveConfigFormLayout(
      baseColumns.value,
      baseFieldSpan.value,
      responsive.value,
      breakpoint,
    )
    next[breakpoint] = {
      columns: Math.min(24, resolved.columns),
      fieldSpan: Math.min(24, resolved.fieldSpan),
    }
  }
  commit(Object.keys(next).length > 0 ? next : undefined)
}

function commitEnabled(breakpoint: Exclude<ConfigFormBreakpoint, 'desktop'>, value: unknown): void {
  if (Boolean(value) !== isEnabled(breakpoint))
    toggle(breakpoint)
}

function commitValue(
  breakpoint: Exclude<ConfigFormBreakpoint, 'desktop'>,
  key: keyof ConfigFormResponsiveLayoutOverride,
  value: unknown,
): void {
  if (typeof value !== 'number')
    return
  const next = cloneResponsive()
  next[breakpoint] = {
    ...next[breakpoint],
    [key]: value,
  }
  commit(next)
}

function cloneResponsive(): ConfigFormResponsiveLayout {
  return {
    ...(responsive.value?.tablet ? { tablet: { ...responsive.value.tablet } } : {}),
    ...(responsive.value?.mobile ? { mobile: { ...responsive.value.mobile } } : {}),
  }
}

function commit(value: ConfigFormResponsiveLayout | undefined): void {
  emit('update:modelValue', value)
  emit('commit', value)
}
</script>

<template>
  <section class="mx-config-form-designer__responsive-settings" :aria-label="locale.t('property.responsive', 'Responsive layout')">
    <div v-if="showHeading" class="mx-config-form-designer__responsive-heading">
      <strong>{{ locale.t('property.responsive', 'Responsive layout') }}</strong>
    </div>
    <div class="mx-config-form-designer__responsive-breakpoint is-resolved">
      <span class="mx-config-form-designer__responsive-label">
        <Monitor :size="15" aria-hidden="true" />
        {{ breakpointTitle('desktop') }}
      </span>
      <output class="mx-config-form-designer__responsive-fraction" :aria-label="resolvedWidthAria('desktop')">
        {{ resolvedWidthText('desktop') }}
      </output>
    </div>
    <div v-for="breakpoint in breakpoints" :key="breakpoint.key" class="mx-config-form-designer__responsive-breakpoint">
      <div class="mx-config-form-designer__responsive-switch-row">
        <span class="mx-config-form-designer__responsive-label">
          <component :is="breakpoint.icon" :size="15" aria-hidden="true" />
          {{ title(breakpoint.key) }}
        </span>
        <DesignerPropertyForm
          class="mx-config-form-designer__responsive-toggle-control"
          :entries="[toggleEntry(breakpoint.key)]"
          :components="components"
          :controls="controls"
          :readonly="isReadonly"
          @commit="commitEnabled(breakpoint.key, $event)"
        />
      </div>

      <output
        class="mx-config-form-designer__responsive-fraction"
        :aria-label="resolvedWidthAria(breakpoint.key, !isEnabled(breakpoint.key))"
      >
        {{ resolvedWidthText(breakpoint.key, !isEnabled(breakpoint.key)) }}
      </output>

      <div v-if="isEnabled(breakpoint.key)" class="mx-config-form-designer__responsive-fields">
        <DesignerPropertyForm
          :entries="[valueEntry(breakpoint.key, 'columns')]"
          :components="components"
          :controls="controls"
          :readonly="isReadonly"
          @commit="commitValue(breakpoint.key, 'columns', $event)"
        />
        <DesignerPropertyForm
          :entries="[valueEntry(breakpoint.key, 'fieldSpan')]"
          :components="components"
          :controls="controls"
          :readonly="isReadonly"
          @commit="commitValue(breakpoint.key, 'fieldSpan', $event)"
        />
      </div>
    </div>
  </section>
</template>
