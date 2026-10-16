<script setup lang="ts">
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form-core'
import { Monitor, Smartphone, Tablet } from '@lucide/vue'
import { nextTick, ref, useId, watch } from 'vue'
import { useDesignerLocale } from '@designer/locale'

const props = withDefaults(defineProps<{
  breakpoint?: ConfigFormBreakpoint
  showHeading?: boolean
}>(), {
  showHeading: true,
})

const locale = useDesignerLocale()
const active = ref<ConfigFormBreakpoint>(props.breakpoint ?? 'desktop')
const tabsId = useId()
const breakpoints = [
  { key: 'desktop', icon: Monitor },
  { key: 'tablet', icon: Tablet },
  { key: 'mobile', icon: Smartphone },
] as const

watch(() => props.breakpoint, (value) => { if (value) active.value = value })

function title(breakpoint: ConfigFormBreakpoint): string {
  if (breakpoint === 'desktop')
    return locale.t('breakpoint.desktop', 'Desktop')
  return breakpoint === 'tablet'
    ? locale.t('breakpoint.tablet', 'Tablet')
    : locale.t('breakpoint.mobile', 'Mobile')
}

function navigateTabs(event: KeyboardEvent): void {
  const index = breakpoints.findIndex(item => item.key === active.value)
  const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : undefined
  if (next === undefined)
    return
  event.preventDefault()
  active.value = breakpoints[next]!.key
  void nextTick(() => document.getElementById(`${tabsId}-${active.value}-tab`)?.focus())
}
</script>

<template>
  <section class="mx-config-form-designer__responsive-settings" :aria-label="locale.t('property.responsive', 'Responsive layout')">
    <div v-if="showHeading" class="mx-config-form-designer__responsive-heading">
      <strong>{{ locale.t('property.responsive', 'Responsive layout') }}</strong>
    </div>

    <div class="mx-config-form-designer__responsive-tabs" role="tablist" :aria-label="locale.t('property.responsive', 'Responsive layout')">
      <button v-for="item in breakpoints" :id="`${tabsId}-${item.key}-tab`" :key="item.key" type="button" role="tab" :aria-selected="active === item.key" :aria-controls="`${tabsId}-${item.key}-panel`" :tabindex="active === item.key ? 0 : -1" @click="active = item.key" @keydown="navigateTabs"><component :is="item.icon" :size="14" aria-hidden="true" />{{ title(item.key) }}</button>
    </div>

    <div
      v-for="item in breakpoints"
      :id="`${tabsId}-${item.key}-panel`"
      :key="item.key"
      v-show="active === item.key"
      role="tabpanel"
      :aria-labelledby="`${tabsId}-${item.key}-tab`"
      :inert="active !== item.key ? true : undefined"
    >
      <slot :name="item.key" />
    </div>
  </section>
</template>
