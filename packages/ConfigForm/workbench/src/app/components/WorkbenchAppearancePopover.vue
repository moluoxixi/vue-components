<script setup lang="ts">
import type {
  WorkbenchAppearancePanelEmits,
  WorkbenchAppearancePopoverProps,
} from '../types'
import { Settings2 } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import WorkbenchAppearancePanel from './WorkbenchAppearancePanel.vue'

const props = defineProps<WorkbenchAppearancePopoverProps>()
const emit = defineEmits<WorkbenchAppearancePanelEmits>()
const locale = computed(() => createDesignerLocale(props.locale))
</script>

<template>
  <ElPopover
    placement="bottom-end"
    :width="344"
    trigger="click"
    :show-after="0"
    :hide-after="0"
    :teleported="true"
    append-to="#workbench-overlays"
    popper-class="workbench-appearance-popover"
  >
    <template #reference>
      <ElButton
        native-type="button"
        :class="['appearance-popover-trigger', triggerClass]"
        circle
        :title="locale.t('appearance.open', 'Open appearance settings')"
        :aria-label="locale.t('appearance.open', 'Open appearance settings')"
      >
        <Settings2 :size="17" aria-hidden="true" />
      </ElButton>
    </template>
    <WorkbenchAppearancePanel
      :locale="locale"
      :palette-family="paletteFamily"
      :theme-preference="themePreference"
      @set-palette-family="emit('setPaletteFamily', $event)"
      @set-theme-preference="emit('setThemePreference', $event)"
    />
  </ElPopover>
</template>
