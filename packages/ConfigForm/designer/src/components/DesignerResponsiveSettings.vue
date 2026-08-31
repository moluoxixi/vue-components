<script setup lang="ts">
import type {
  ConfigFormBreakpoint,
  ConfigFormResponsiveLayout,
  ConfigFormResponsiveLayoutOverride,
} from '@moluoxixi/config-form/renderer'
import type { FormSettings } from '@moluoxixi/config-form-model'
import type { DesignerPropertySetterDefinition } from '../registry'
import { Smartphone, Tablet } from '@lucide/vue'
import { resolveConfigFormLayout } from '@moluoxixi/config-form/renderer'
import { computed } from 'vue'
import { useDesignerLocale } from '../locale'
import DesignerSetter from './DesignerSetter.vue'

const props = withDefaults(defineProps<{
  modelValue?: ConfigFormResponsiveLayout
  columns?: number
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
    <div v-for="breakpoint in breakpoints" :key="breakpoint.key" class="mx-config-form-designer__responsive-breakpoint">
      <button
        type="button"
        class="mx-config-form-designer__switch-row is-compact"
        role="switch"
        :aria-label="locale.t('property.breakpointLayout', '{breakpoint} layout', { breakpoint: title(breakpoint.key) })"
        :aria-checked="isEnabled(breakpoint.key)"
        :disabled="isReadonly"
        @click="toggle(breakpoint.key)"
      >
        <span class="mx-config-form-designer__responsive-label">
          <component :is="breakpoint.icon" :size="15" aria-hidden="true" />
          {{ title(breakpoint.key) }}
        </span>
        <span class="mx-config-form-designer__switch" :class="{ 'is-on': isEnabled(breakpoint.key) }" aria-hidden="true"><span /></span>
      </button>

      <div v-if="isEnabled(breakpoint.key)" class="mx-config-form-designer__responsive-fields">
        <DesignerSetter
          :setter="setter(breakpoint.key, 'columns')"
          :value="responsive?.[breakpoint.key]?.columns"
          :readonly="isReadonly"
          @commit="commitValue(breakpoint.key, 'columns', $event)"
        />
        <DesignerSetter
          :setter="setter(breakpoint.key, 'fieldSpan')"
          :value="responsive?.[breakpoint.key]?.fieldSpan"
          :readonly="isReadonly"
          @commit="commitValue(breakpoint.key, 'fieldSpan', $event)"
        />
      </div>
    </div>
  </section>
</template>
