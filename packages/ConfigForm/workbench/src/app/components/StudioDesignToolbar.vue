<script setup lang="ts">
import type { DesignerLocaleOptions, DesignSurfaceToolbarScope } from '@moluoxixi/config-form-designer'
import { Columns2, Copy, Monitor, Redo2, Smartphone, Tablet, Trash2, Undo2 } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import WorkbenchCommandHint from './WorkbenchCommandHint/index.vue'

const props = withDefaults(defineProps<{ scope: DesignSurfaceToolbarScope, locale?: DesignerLocaleOptions, showCompare?: boolean }>(), { showCompare: true })
const emit = defineEmits<{ compare: [] }>()
const locale = computed(() => createDesignerLocale(props.locale))
</script>

<template>
  <div
    class="mx-config-form-designer__toolbar-actions"
    role="toolbar"
    :aria-label="locale.t('designer.commands', 'Designer commands')"
  >
    <WorkbenchCommandHint
      :label="locale.t('action.undo', 'Undo')"
      shortcut="Ctrl/Cmd+Z"
      :disabled-reason="!scope.canUndo ? locale.t('action.undoUnavailable', 'No operation to undo') : undefined"
    >
      <button
        type="button"
        class="mx-config-form-designer__icon-button"
        :aria-disabled="!scope.canUndo ? 'true' : undefined"
        :title="locale.t('action.undoShortcut', 'Undo (Ctrl/Cmd+Z)')"
        :aria-label="locale.t('action.undo', 'Undo')"
        aria-keyshortcuts="Control+Z Meta+Z"
        @click="scope.canUndo && scope.undo()"
      >
        <Undo2 :size="17" aria-hidden="true" />
      </button>
    </WorkbenchCommandHint>
    <WorkbenchCommandHint
      :label="locale.t('action.redo', 'Redo')"
      shortcut="Ctrl/Cmd+Shift+Z"
      :disabled-reason="!scope.canRedo ? locale.t('action.redoUnavailable', 'No operation to redo') : undefined"
    >
      <button
        type="button"
        class="mx-config-form-designer__icon-button"
        :aria-disabled="!scope.canRedo ? 'true' : undefined"
        :title="locale.t('action.redoShortcut', 'Redo (Ctrl/Cmd+Shift+Z)')"
        :aria-label="locale.t('action.redo', 'Redo')"
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        @click="scope.canRedo && scope.redo()"
      >
        <Redo2 :size="17" aria-hidden="true" />
      </button>
    </WorkbenchCommandHint>
    <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
    <WorkbenchCommandHint
      :label="locale.t('node.copySelection', 'Copy selection')"
      shortcut="Ctrl/Cmd+D"
      :disabled-reason="
        !scope.canEditSelection ? locale.t('node.selectionRequired', 'Select a component first') : undefined
      "
    >
      <button
        type="button"
        class="mx-config-form-designer__icon-button"
        :aria-disabled="!scope.canEditSelection ? 'true' : undefined"
        :title="locale.t('node.copySelectionShortcut', 'Copy selection (Ctrl/Cmd+D)')"
        :aria-label="locale.t('node.copySelection', 'Copy selection')"
        aria-keyshortcuts="Control+D Meta+D"
        @click="scope.canEditSelection && scope.copySelection()"
      >
        <Copy :size="16" aria-hidden="true" />
      </button>
    </WorkbenchCommandHint>
    <WorkbenchCommandHint
      :label="locale.t('node.deleteSelection', 'Delete selection')"
      shortcut="Delete"
      :disabled-reason="
        !scope.canEditSelection ? locale.t('node.selectionRequired', 'Select a component first') : undefined
      "
    >
      <button
        type="button"
        class="mx-config-form-designer__icon-button is-danger"
        :aria-disabled="!scope.canEditSelection ? 'true' : undefined"
        :title="locale.t('node.deleteSelectionShortcut', 'Delete selection (Delete)')"
        :aria-label="locale.t('node.deleteSelection', 'Delete selection')"
        aria-keyshortcuts="Delete Backspace"
        @click="scope.canEditSelection && scope.removeSelection()"
      >
        <Trash2 :size="16" aria-hidden="true" />
      </button>
    </WorkbenchCommandHint>
    <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
    <div
      class="mx-config-form-designer__segmented"
      role="group"
      :aria-label="locale.t('canvas.viewport', 'Canvas viewport')"
    >
      <WorkbenchCommandHint :label="locale.t('canvas.desktop', 'Desktop')">
        <button
          type="button"
          :class="{ 'is-active': scope.breakpoint === 'desktop' }"
          :aria-pressed="scope.breakpoint === 'desktop'"
          :title="locale.t('canvas.desktop', 'Desktop')"
          :aria-label="locale.t('canvas.desktop', 'Desktop')"
          @click="scope.selectBreakpoint('desktop')"
        >
          <Monitor :size="15" aria-hidden="true" />
        </button>
      </WorkbenchCommandHint>
      <WorkbenchCommandHint :label="locale.t('canvas.tablet', 'Tablet')">
        <button
          type="button"
          :class="{ 'is-active': scope.breakpoint === 'tablet' }"
          :aria-pressed="scope.breakpoint === 'tablet'"
          :title="locale.t('canvas.tablet', 'Tablet')"
          :aria-label="locale.t('canvas.tablet', 'Tablet')"
          @click="scope.selectBreakpoint('tablet')"
        >
          <Tablet :size="15" aria-hidden="true" />
        </button>
      </WorkbenchCommandHint>
      <WorkbenchCommandHint :label="locale.t('canvas.mobile', 'Mobile')">
        <button
          type="button"
          :class="{ 'is-active': scope.breakpoint === 'mobile' }"
          :aria-pressed="scope.breakpoint === 'mobile'"
          :title="locale.t('canvas.mobile', 'Mobile')"
          :aria-label="locale.t('canvas.mobile', 'Mobile')"
          @click="scope.selectBreakpoint('mobile')"
        >
          <Smartphone :size="15" aria-hidden="true" />
        </button>
      </WorkbenchCommandHint>
    </div>
    <button
      v-if="showCompare"
      type="button"
      class="mx-config-form-designer__icon-button"
      :aria-label="locale.locale === 'zh-CN' ? '响应式对照' : 'Compare responsive layouts'"
      :title="locale.locale === 'zh-CN' ? '响应式对照' : 'Compare responsive layouts'"
      @click="emit('compare')"
    >
      <Columns2 :size="16" />
    </button>
  </div>
</template>
