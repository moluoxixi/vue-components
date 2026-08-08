<script setup lang="ts">
import type {
  ConfigFormBreakpoint,
  ConfigFormResponsiveLayout,
  ConfigFormResponsiveLayoutOverride,
} from '@moluoxixi/config-form/renderer'
import type { DesignerFormSettings } from '../document'
import type { DesignerPropertySetterDefinition } from '../registry'
import { Smartphone, Tablet } from '@lucide/vue'
import { resolveConfigFormLayout } from '@moluoxixi/config-form/renderer'
import { useDesignerLocale } from '../locale'
import DesignerSetter from './DesignerSetter.vue'

const props = defineProps<{
  form: DesignerFormSettings
  readonly?: boolean
}>()

const emit = defineEmits<{
  commit: [value: ConfigFormResponsiveLayout | undefined]
}>()

const locale = useDesignerLocale()
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
  return props.form.responsive?.[breakpoint] !== undefined
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
      props.form.columns,
      props.form.fieldSpan,
      props.form.responsive,
      breakpoint,
    )
    next[breakpoint] = {
      columns: Math.min(24, resolved.columns),
      fieldSpan: Math.min(24, resolved.fieldSpan),
    }
  }
  emit('commit', Object.keys(next).length > 0 ? next : undefined)
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
  emit('commit', next)
}

function cloneResponsive(): ConfigFormResponsiveLayout {
  return {
    ...(props.form.responsive?.tablet ? { tablet: { ...props.form.responsive.tablet } } : {}),
    ...(props.form.responsive?.mobile ? { mobile: { ...props.form.responsive.mobile } } : {}),
  }
}
</script>

<template>
  <section class="mx-config-form-designer__responsive-settings" :aria-label="locale.t('property.responsive', 'Responsive layout')">
    <div class="mx-config-form-designer__responsive-heading">
      <strong>{{ locale.t('property.responsive', 'Responsive layout') }}</strong>
    </div>
    <div v-for="breakpoint in breakpoints" :key="breakpoint.key" class="mx-config-form-designer__responsive-breakpoint">
      <button
        type="button"
        class="mx-config-form-designer__switch-row is-compact"
        role="switch"
        :aria-label="locale.t('property.breakpointLayout', '{breakpoint} layout', { breakpoint: title(breakpoint.key) })"
        :aria-checked="isEnabled(breakpoint.key)"
        :disabled="readonly"
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
          :value="form.responsive?.[breakpoint.key]?.columns"
          :readonly="readonly"
          @commit="commitValue(breakpoint.key, 'columns', $event)"
        />
        <DesignerSetter
          :setter="setter(breakpoint.key, 'fieldSpan')"
          :value="form.responsive?.[breakpoint.key]?.fieldSpan"
          :readonly="readonly"
          @commit="commitValue(breakpoint.key, 'fieldSpan', $event)"
        />
      </div>
    </div>
  </section>
</template>
