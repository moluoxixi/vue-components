<script setup lang="ts">
import type {
  WorkbenchAppearanceDrawerEmits,
  WorkbenchAppearanceDrawerProps,
} from '../types'
import { X } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, watch } from 'vue'
import WorkbenchAppearancePanel from './WorkbenchAppearancePanel.vue'

const props = defineProps<WorkbenchAppearanceDrawerProps>()
const emit = defineEmits<WorkbenchAppearanceDrawerEmits>()
const locale = computed(() => createDesignerLocale(props.locale))
let returnFocus: HTMLElement | undefined

watch(() => props.open, (open, wasOpen) => {
  if (open) {
    returnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined
    return
  }
  const target = returnFocus
  returnFocus = undefined
  if (wasOpen && target?.isConnected)
    void nextTick(() => target.focus())
})
</script>

<template>
  <ElDrawer
    v-if="open"
    class="appearance-drawer-shell"
    modal-class="appearance-drawer-overlay"
    :model-value="open"
    direction="rtl"
    size="min(92vw, 380px)"
    append-to="#workbench-overlays"
    destroy-on-close
    :lock-scroll="true"
    :trap-focus="true"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    :show-close="true"
    :with-header="false"
    :aria-label="locale.t('appearance.title', 'Appearance')"
    @close="emit('close')"
  >
    <ElButton
      class="appearance-drawer-close"
      native-type="button"
      text
      circle
      :title="locale.t('action.close', 'Close')"
      :aria-label="locale.t('action.close', 'Close')"
      @click="emit('close')"
    >
      <X :size="18" aria-hidden="true" />
    </ElButton>
    <WorkbenchAppearancePanel
      :locale="locale"
      :palette-family="paletteFamily"
      :theme-preference="themePreference"
      @set-palette-family="emit('setPaletteFamily', $event)"
      @set-theme-preference="emit('setThemePreference', $event)"
    />
  </ElDrawer>
</template>
