<script setup lang="ts">
import type {
  WorkbenchAppearancePanelEmits,
  WorkbenchAppearancePopoverProps,
} from '../types'
import { Settings2 } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import WorkbenchCommandHint from '../../components/WorkbenchCommandHint/index.vue'
import WorkbenchAppearancePanel from './WorkbenchAppearancePanel.vue'

const props = defineProps<WorkbenchAppearancePopoverProps>()
const emit = defineEmits<WorkbenchAppearancePanelEmits>()
const locale = computed(() => createDesignerLocale(props.locale))
</script>

<template>
  <WorkbenchCommandHint detached :anchor-class="triggerClass" :label="locale.t('appearance.open', 'Open appearance settings')">
    <ElPopover
      placement="bottom-end"
      :width="344"
      trigger="click"
      transition="none"
      :show-after="0"
      :hide-after="0"
      :teleported="true"
      append-to="#workbench-overlays"
      popper-class="workbench-appearance-popover"
    >
      <template #reference>
        <ElButton
          native-type="button"
          class="appearance-popover-trigger" :class="[triggerClass]"
          circle
          :aria-label="locale.t('appearance.open', 'Open appearance settings')"
        >
          <Settings2 :size="17" aria-hidden="true" />
        </ElButton>
      </template>
      <WorkbenchAppearancePanel
        :locale="props.locale"
        :palette-family="paletteFamily"
        :theme-preference="themePreference"
        @set-palette-family="emit('setPaletteFamily', $event)"
        @set-theme-preference="emit('setThemePreference', $event)"
      />
    </ElPopover>
  </WorkbenchCommandHint>
</template>
