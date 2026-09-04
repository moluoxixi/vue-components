<script setup lang="ts">
import type {
  PopoverTableSelectBaseEmits,
  PopoverTableSelectBaseProps,
  PopoverTableSelectSlotScope,
  PopoverTableSelectSlots,
} from '../../types'
import type { ConfigTableCellParams } from '#components/ConfigTable'
import { ElPopover } from 'element-plus'
import { computed, useTemplateRef } from 'vue'
import { ConfigTable } from '#components/ConfigTable'
import { usePopoverTableSelectBase } from '../../composables'

defineOptions({
  name: 'PopoverTableSelectBase',
})

const props = withDefaults(defineProps<PopoverTableSelectBaseProps>(), {
  popoverProps: () => ({}),
  height: 300,
  id: 'popoverTableSelect',
  columns: () => [],
  data: () => [],
  width: 400,
  placement: 'bottom',
  selectTrigger: 'click',
  virtualRef: null,
  zIndex: undefined,
  loading: false,
  scrollY: () => ({ enabled: false, threshold: 0 }),
})

const emit = defineEmits<PopoverTableSelectBaseEmits>()
const slots = defineSlots<PopoverTableSelectSlots>()
const popoverVisible = defineModel<boolean>({ default: false })
const currentRowIndex = defineModel<number>('currentRowIndex', { default: 0 })

const popoverRef = useTemplateRef<HTMLElement>('popoverRef')
const elPopoverRef = useTemplateRef<any>('elPopoverRef')
const tableSlotNames = computed<string[]>(() => Object.keys(slots).filter(name => name !== 'footer'))

function onCellClick(params: ConfigTableCellParams): void {
  if (!params.event)
    return

  handleCellClick(
    params.row,
    params.column,
    params.rowIndex,
    params.columnIndex,
    params.event,
  )
}

function onCellDblClick(params: ConfigTableCellParams): void {
  if (!params.event)
    return

  handleCellDblClick(
    params.row,
    params.column,
    params.rowIndex,
    params.columnIndex,
    params.event,
  )
}

const {
  computedPopoverProps,
  handleCellClick,
  handleCellDblClick,
  handleTableScroll,
  popoverRefStyle,
  popoverTableProps,
  tableHeight,
  tableWidth,
  tableWrapperStyle,
} = usePopoverTableSelectBase(
  props,
  emit,
  { currentRowIndex, visible: popoverVisible },
  { elPopover: elPopoverRef, popover: popoverRef },
)
</script>

<template>
  <ElPopover
    ref="elPopoverRef"
    :visible="popoverVisible"
    virtual-triggering
    :virtual-ref="props.virtualRef"
    v-bind="computedPopoverProps"
  >
    <div ref="popoverRef" class="mx-popover-table-select-base" :style="popoverRefStyle">
      <slot name="default" />
      <div
        class="mx-popover-table-select-base__table-wrap"
        :style="tableWrapperStyle"
        @mousedown.stop
        @scroll="handleTableScroll"
      >
        <ConfigTable
          :columns="props.columns"
          :data="props.data"
          :current-row-index="currentRowIndex"
          :empty-text="props.loading ? '加载中...' : '暂无数据'"
          :height="tableHeight"
          :table-props="popoverTableProps"
          :width="tableWidth"
          @cell-click="onCellClick"
          @cell-dbl-click="onCellDblClick"
        >
          <template
            v-for="name in tableSlotNames"
            #[name]="slotParams"
          >
            <slot :name="name" v-bind="slotParams as PopoverTableSelectSlotScope" />
          </template>
          <template #empty>
            <span v-if="props.loading">加载中...</span>
            <span v-else>暂无数据</span>
          </template>
        </ConfigTable>
        <div v-if="props.loading && props.data.length > 0" class="mx-popover-table-select-base__loading">
          加载中...
        </div>
      </div>
      <div v-if="slots.footer" class="mx-popover-table-select-base__footer" @mousedown.stop>
        <slot name="footer" />
      </div>
    </div>
  </ElPopover>
</template>

<style scoped>
.mx-popover-table-select-base {
  min-width: 100%;
}

.mx-popover-table-select-base__table-wrap {
  position: relative;
  overflow: auto;
}

:deep(.mx-popover-table-select-base__row--current) {
  background: var(--el-fill-color);
}

.mx-popover-table-select-base__loading {
  position: sticky;
  bottom: 0;
  padding: 18px;
  color: var(--el-text-color-secondary);
  text-align: center;
  background: var(--el-bg-color);
}

.mx-popover-table-select-base__footer {
  margin-top: 8px;
}
</style>
