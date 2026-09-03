<script setup lang="ts">
import type { Component } from 'vue'
import type { DesignerNodeAction } from '../../../../../DesignSurface/types'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  CornerDownLeft,
  CornerDownRight,
  GripVertical,
  MoreHorizontal,
  Trash2,
} from '@lucide/vue'
import { useDesignerLocale } from '../../../../../../locale'
import { DesignerCommandHint } from '../../../../../DesignerCommandHint'

defineProps<{
  commandHint?: Component
  keyboardDragging: boolean
  menuId: string
  menuOpen: boolean
  nodeId: string
  readonly: boolean
}>()

const emit = defineEmits<{
  action: [action: Extract<DesignerNodeAction, 'copy' | 'remove'>]
  beginDrag: [event: PointerEvent]
  dragKeydown: [event: KeyboardEvent]
  menuAction: [action: Exclude<DesignerNodeAction, 'copy' | 'remove'>]
  menuKeydown: [event: KeyboardEvent]
  toggleMenu: []
  toolbarKeydown: [event: KeyboardEvent]
}>()

const locale = useDesignerLocale()
</script>

<template>
  <div
    class="mx-config-form-designer__node-actions"
    role="toolbar"
    :aria-label="locale.t('node.actions', 'Node actions')"
    aria-hidden="false"
    data-designer-editor-control
    @keydown="emit('toolbarKeydown', $event)"
  >
    <DesignerCommandHint :renderer="commandHint" :label="locale.t('node.moveNode', 'Move node')" shortcut="Space" :disabled-reason="readonly ? locale.t('action.readonlyUnavailable', 'Editing is unavailable while the designer is read-only') : undefined">
      <button data-node-toolbar-button type="button" class="mx-config-form-designer__icon-button mx-config-form-designer__drag-handle" :aria-disabled="readonly ? 'true' : undefined" aria-keyshortcuts="Space" :title="locale.t('node.move', 'Move')" :aria-label="locale.t('node.moveNode', 'Move node')" :aria-pressed="keyboardDragging" :data-designer-drag-node-id="nodeId" @keydown="emit('dragKeydown', $event)" @pointerdown="emit('beginDrag', $event)"><GripVertical :size="16" aria-hidden="true" /></button>
    </DesignerCommandHint>
    <DesignerCommandHint :renderer="commandHint" :label="locale.t('node.copyNode', 'Copy node')" shortcut="Ctrl/Cmd+D" :disabled-reason="readonly ? locale.t('action.readonlyUnavailable', 'Editing is unavailable while the designer is read-only') : undefined">
      <button data-node-toolbar-button type="button" class="mx-config-form-designer__icon-button" :aria-disabled="readonly ? 'true' : undefined" aria-keyshortcuts="Control+D Meta+D" :title="locale.t('node.copy', 'Copy')" :aria-label="locale.t('node.copyNode', 'Copy node')" @click.stop="!readonly && emit('action', 'copy')"><Copy :size="15" aria-hidden="true" /></button>
    </DesignerCommandHint>
    <DesignerCommandHint :renderer="commandHint" :label="locale.t('node.deleteNode', 'Delete node')" shortcut="Delete" :disabled-reason="readonly ? locale.t('action.readonlyUnavailable', 'Editing is unavailable while the designer is read-only') : undefined">
      <button data-node-toolbar-button type="button" class="mx-config-form-designer__icon-button is-danger" :aria-disabled="readonly ? 'true' : undefined" aria-keyshortcuts="Delete Backspace" :title="locale.t('node.delete', 'Delete')" :aria-label="locale.t('node.deleteNode', 'Delete node')" @click.stop="!readonly && emit('action', 'remove')"><Trash2 :size="15" aria-hidden="true" /></button>
    </DesignerCommandHint>
    <button
      :id="`${menuId}-trigger`"
      data-node-toolbar-button
      data-node-action-menu-trigger
      type="button"
      class="mx-config-form-designer__icon-button"
      :aria-disabled="readonly ? 'true' : undefined"
      :title="readonly ? `${locale.t('node.moreActions', 'More actions')} · ${locale.t('action.readonlyUnavailable', 'Editing is unavailable while the designer is read-only')}` : locale.t('node.moreActions', 'More actions')"
      :aria-label="readonly ? `${locale.t('node.moreActions', 'More actions')} · ${locale.t('action.readonlyUnavailable', 'Editing is unavailable while the designer is read-only')}` : locale.t('node.moreActions', 'More actions')"
      aria-haspopup="menu"
      :aria-controls="menuId"
      :aria-expanded="menuOpen"
      @click.stop="!readonly && emit('toggleMenu')"
    >
      <MoreHorizontal :size="16" aria-hidden="true" />
    </button>
    <div
      v-if="menuOpen"
      :id="menuId"
      class="mx-config-form-designer__node-action-menu"
      data-node-action-menu
      role="menu"
      :aria-labelledby="`${menuId}-trigger`"
      @keydown="emit('menuKeydown', $event)"
    >
      <button type="button" role="menuitem" tabindex="-1" :aria-label="locale.t('node.moveNodeUp', 'Move node up')" @click.stop="emit('menuAction', 'moveBefore')"><ChevronUp :size="15" aria-hidden="true" /><span>{{ locale.t('node.moveUp', 'Move up') }}</span></button>
      <button type="button" role="menuitem" tabindex="-1" :aria-label="locale.t('node.moveNodeDown', 'Move node down')" @click.stop="emit('menuAction', 'moveAfter')"><ChevronDown :size="15" aria-hidden="true" /><span>{{ locale.t('node.moveDown', 'Move down') }}</span></button>
      <button type="button" role="menuitem" tabindex="-1" :aria-label="locale.t('node.indentNode', 'Move node into previous container')" @click.stop="emit('menuAction', 'indent')"><CornerDownRight :size="15" aria-hidden="true" /><span>{{ locale.t('node.indent', 'Indent') }}</span></button>
      <button type="button" role="menuitem" tabindex="-1" :aria-label="locale.t('node.outdentNode', 'Move node out of container')" @click.stop="emit('menuAction', 'outdent')"><CornerDownLeft :size="15" aria-hidden="true" /><span>{{ locale.t('node.outdent', 'Outdent') }}</span></button>
    </div>
  </div>
</template>
