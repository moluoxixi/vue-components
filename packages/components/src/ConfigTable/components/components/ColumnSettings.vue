<script setup lang="ts">
import type { HeadlessTableColumn } from '#components/HeadlessTable'
import type {
  ConfigTableColumn,
  ConfigTableColumnSettingChange,
  ConfigTableColumnWidthState,
  ConfigTablePaneConfig,
  ConfigTableRow,
} from '../../types'
import { ChevronDown, ChevronUp, GripVertical, Settings } from '@lucide/vue'
import { ElButton, ElCheckbox, ElDialog, ElInputNumber, ElTooltip } from 'element-plus'
import Sortable from 'sortablejs'
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import {
  getHeadlessTableColumnLabel,
  projectHeadlessTableColumns,
} from '#components/HeadlessTable'
import {
  getConfigTableColumnId,
  getConfigTableColumnWidth,
} from '../../utils'

interface ColumnSettingItem {
  id: string
  label: string
  visible: boolean
  width: number
}

const props = defineProps<{
  columns: ConfigTableColumn[]
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  columnWidths: ConfigTableColumnWidthState
  defaultColumnWidth: number
  pane: ConfigTablePaneConfig
}>()

const emit = defineEmits<{
  apply: [value: ConfigTableColumnSettingChange]
}>()

const dialogVisible = ref(false)
const draftItems = ref<ColumnSettingItem[]>([])
const listRef = useTemplateRef<HTMLElement>('listRef')
const visibleCount = computed(() => draftItems.value.filter(item => item.visible).length)
const canApply = computed(() => draftItems.value.length === 0 || visibleCount.value > 0)
let sortable: Sortable | null = null
let sortableSetupVersion = 0

function createDraft(): ColumnSettingItem[] {
  const projection = projectHeadlessTableColumns(
    props.columns as HeadlessTableColumn<ConfigTableRow>[],
    props.columnOrder,
    props.columnVisibility,
  )
  const visibleIds = new Set(projection.columns.map(item => item.columnId))

  return projection.allColumns.map(({ column, columnId, sourceIndex }) => ({
    id: columnId,
    label: getHeadlessTableColumnLabel(column, sourceIndex),
    visible: visibleIds.has(columnId),
    width: getConfigTableColumnWidth(
      column as ConfigTableColumn,
      sourceIndex,
      props.columnWidths,
      {
        defaultColumnWidth: props.defaultColumnWidth,
        minColumnWidth: props.pane.minColumnWidth,
        maxColumnWidth: props.pane.maxColumnWidth,
      },
    ),
  }))
}

function resetSettings(): void {
  draftItems.value = createDraftFromSource()
}

function createDraftFromSource(): ColumnSettingItem[] {
  const sourceColumns = props.columns.map((column, sourceIndex) => ({
    column: column as HeadlessTableColumn<ConfigTableRow>,
    columnId: getConfigTableColumnId(column, sourceIndex),
    sourceIndex,
  }))

  return sourceColumns.map(({ column, columnId, sourceIndex }) => ({
    id: columnId,
    label: getHeadlessTableColumnLabel(column, sourceIndex),
    visible: column.visible !== false,
    width: getConfigTableColumnWidth(
      column as ConfigTableColumn,
      sourceIndex,
      {},
      {
        defaultColumnWidth: props.defaultColumnWidth,
        minColumnWidth: props.pane.minColumnWidth,
        maxColumnWidth: props.pane.maxColumnWidth,
      },
    ),
  }))
}

function openSettings(): void {
  draftItems.value = createDraft()
  dialogVisible.value = true
}

function destroySortable(): void {
  sortableSetupVersion += 1
  sortable?.destroy()
  sortable = null
}

function isSortableEnabled(): boolean {
  return props.pane.draggable !== false
}

function moveItem(from: number, to: number): void {
  if (from === to || from < 0 || to < 0 || from >= draftItems.value.length || to >= draftItems.value.length)
    return

  const nextItems = [...draftItems.value]
  const [item] = nextItems.splice(from, 1)
  if (!item)
    return
  nextItems.splice(to, 0, item)
  draftItems.value = nextItems
}

async function setupSortable(): Promise<void> {
  destroySortable()
  if (!isSortableEnabled())
    return

  const setupVersion = sortableSetupVersion
  await nextTick()
  if (
    setupVersion !== sortableSetupVersion
    || !isSortableEnabled()
    || !dialogVisible.value
    || !listRef.value
  )
    return

  sortable = Sortable.create(listRef.value, {
    animation: 150,
    chosenClass: 'mx-config-table-column-settings__item--chosen',
    ghostClass: 'mx-config-table-column-settings__item--ghost',
    handle: '.mx-config-table-column-settings__drag',
    onEnd: ({ oldIndex, newIndex }) => {
      if (oldIndex != null && newIndex != null)
        moveItem(oldIndex, newIndex)
    },
  })
}

function setVisible(index: number, visible: boolean): void {
  if (!visible && visibleCount.value <= 1)
    return
  const item = draftItems.value[index]
  if (item)
    item.visible = visible
}

function applySettings(): void {
  if (!canApply.value)
    return

  emit('apply', {
    columnOrder: draftItems.value.map(item => item.id),
    columnVisibility: Object.fromEntries(draftItems.value.map(item => [item.id, item.visible])),
    columnWidths: Object.fromEntries(draftItems.value.map(item => [item.id, item.width])),
  })
  dialogVisible.value = false
}

watch(dialogVisible, (visible) => {
  if (visible)
    void setupSortable()
  else
    destroySortable()
})

watch(() => props.pane.draggable, () => {
  if (dialogVisible.value)
    void setupSortable()
})

onBeforeUnmount(destroySortable)
</script>

<template>
  <div class="mx-config-table-column-settings">
    <ElButton class="mx-config-table-column-settings__trigger" @click="openSettings">
      <Settings :size="16" aria-hidden="true" />
      <span>{{ props.pane.buttonText }}</span>
    </ElButton>

    <ElDialog
      v-model="dialogVisible"
      class="mx-config-table-column-settings__dialog"
      :title="props.pane.title"
      :width="props.pane.width"
      append-to-body
      destroy-on-close
    >
      <div ref="listRef" class="mx-config-table-column-settings__list">
        <div
          v-for="(item, index) in draftItems"
          :key="item.id"
          class="mx-config-table-column-settings__item"
          :class="{ 'mx-config-table-column-settings__item--static': props.pane.draggable === false }"
          :data-column-id="item.id"
        >
          <button
            v-if="props.pane.draggable !== false"
            class="mx-config-table-column-settings__drag"
            type="button"
            title="拖拽调整顺序"
            :aria-label="`拖拽调整 ${item.label} 的顺序`"
          >
            <GripVertical :size="18" aria-hidden="true" />
          </button>
          <ElCheckbox
            class="mx-config-table-column-settings__checkbox"
            :disabled="item.visible && visibleCount <= 1"
            :model-value="item.visible"
            @change="setVisible(index, Boolean($event))"
          >
            {{ item.label }}
          </ElCheckbox>
          <ElInputNumber
            v-model="item.width"
            class="mx-config-table-column-settings__width"
            :aria-label="`${item.label} 宽度`"
            :min="props.pane.minColumnWidth"
            :max="props.pane.maxColumnWidth"
            :step="props.pane.columnWidthStep ?? 10"
            controls-position="right"
          />
          <div class="mx-config-table-column-settings__moves">
            <ElTooltip content="上移" placement="top">
              <ElButton
                text
                circle
                :aria-label="`上移 ${item.label}`"
                :disabled="index === 0"
                @click="moveItem(index, index - 1)"
              >
                <ChevronUp :size="16" aria-hidden="true" />
              </ElButton>
            </ElTooltip>
            <ElTooltip content="下移" placement="top">
              <ElButton
                text
                circle
                :aria-label="`下移 ${item.label}`"
                :disabled="index === draftItems.length - 1"
                @click="moveItem(index, index + 1)"
              >
                <ChevronDown :size="16" aria-hidden="true" />
              </ElButton>
            </ElTooltip>
          </div>
        </div>
      </div>

      <template #footer>
        <ElButton text @click="resetSettings">
          重置
        </ElButton>
        <span class="mx-config-table-column-settings__footer-spacer" />
        <ElButton @click="dialogVisible = false">
          取消
        </ElButton>
        <ElButton type="primary" :disabled="!canApply" @click="applySettings">
          确定
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.mx-config-table-column-settings {
  display: flex;
  justify-content: flex-end;
}

.mx-config-table-column-settings__trigger {
  gap: 6px;
}

.mx-config-table-column-settings__list {
  display: grid;
  gap: 6px;
  max-height: min(52vh, 480px);
  overflow-y: auto;
}

.mx-config-table-column-settings__item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) minmax(112px, 132px) auto;
  align-items: center;
  min-height: 42px;
  padding: 4px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-bg-color);
}

.mx-config-table-column-settings__item--ghost {
  opacity: 0.45;
  background: var(--el-color-primary-light-9);
}

.mx-config-table-column-settings__item--chosen {
  border-color: var(--el-color-primary-light-5);
}

.mx-config-table-column-settings__item--static {
  grid-template-columns: minmax(0, 1fr) minmax(112px, 132px) auto;
}

.mx-config-table-column-settings__drag {
  display: inline-grid;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--el-text-color-secondary);
  cursor: grab;
  background: transparent;
  border: 0;
  place-items: center;
}

.mx-config-table-column-settings__drag:active {
  cursor: grabbing;
}

.mx-config-table-column-settings__drag:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 1px;
}

.mx-config-table-column-settings__checkbox {
  min-width: 0;
}

.mx-config-table-column-settings__checkbox :deep(.el-checkbox__label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mx-config-table-column-settings__width {
  width: 132px;
}

.mx-config-table-column-settings__moves {
  display: flex;
  gap: 2px;
}

.mx-config-table-column-settings__footer-spacer {
  flex: 1;
}

:global(.mx-config-table-column-settings__dialog .el-dialog__footer) {
  display: flex;
  align-items: center;
}

@media (max-width: 520px) {
  :global(.mx-config-table-column-settings__dialog) {
    width: calc(100vw - 32px) !important;
  }

  .mx-config-table-column-settings__item {
    grid-template-columns: 32px minmax(0, 1fr) auto;
  }

  .mx-config-table-column-settings__item--static {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .mx-config-table-column-settings__width {
    grid-column: 2 / 4;
    width: 100%;
  }

  .mx-config-table-column-settings__item--static .mx-config-table-column-settings__width {
    grid-column: 1 / 3;
  }
}
</style>
