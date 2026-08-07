<script setup lang="ts">
import type { InputInstance } from 'element-plus'
import type {
  PopoverTableRow,
  PopoverTableSelectEmits,
  PopoverTableSelectRuntimeProps,
  PopoverTableSelectSlots,
} from './types'
import { ElInput, ElPagination } from 'element-plus'
import { computed, useTemplateRef } from 'vue'
import { PopoverTableSelectBase } from './components'
import {
  usePopoverTableSelectInput,
  usePopoverTableSelectRequest,
  usePopoverTableSelectScheduling,
} from './composables'

defineOptions({
  name: 'PopoverTableSelect',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<PopoverTableSelectRuntimeProps>(), {
  debounce: 0,
  throttle: 300,
  options: () => ({}),
  popType: 'input',
  placeholder: '点击或按下方向键试试',
  popoverProps: () => ({}),
  inputProps: () => ({}),
  virtualRef: null,
  successiveShowType: 'enter',
  onInput: undefined,
  enableLoadMore: false,
  hasMore: false,
  loading: false,
  data: () => [],
  params: () => ({}),
  enabled: true,
  pagination: undefined,
  resetPageOnParamsChange: true,
})

const emit = defineEmits<PopoverTableSelectEmits>()

const slots = defineSlots<PopoverTableSelectSlots>()

const popoverModel = defineModel<boolean>({ default: false })
const inputValue = defineModel<string>('inputValue', { default: '' })
const currentPage = defineModel<number>('currentPage', { default: 1 })
const pageSize = defineModel<number>('pageSize', { default: 10 })

const inputRef = useTemplateRef<InputInstance>('inputRef')

const slotNames = computed<string[]>(() => Object.keys(slots).filter(name => name !== 'footer'))

function handleSelect(row: PopoverTableRow): void {
  emit('select', row)
}

function handleScrollBoundary(payload: { direction: 'bottom' }): void {
  if (props.enableLoadMore && props.hasMore && payload.direction === 'bottom')
    emit('loadMore')
}

const {
  computedPlaceholder,
  computedVirtualRef,
  currentInputValue,
  handleBlur,
  handleClear,
  handleEnter,
  handleFocus,
  handleInput,
  isBaseMounted,
} = usePopoverTableSelectInput(props, emit, { inputValue, popoverVisible: popoverModel }, inputRef)

const { scheduledInput, scheduledSelect } = usePopoverTableSelectScheduling(props, handleSelect, handleInput)

const {
  computedLoading,
  handleCurrentPageUpdate,
  handlePageSizeUpdate,
  paginationProps,
  requestTotal,
  shouldShowPagination,
  tableData,
} = usePopoverTableSelectRequest(props, emit, { currentPage, pageSize })
</script>

<template>
  <div class="mx-popover-table-select">
    <PopoverTableSelectBase
      v-if="isBaseMounted"
      v-model="popoverModel"
      :virtual-ref="computedVirtualRef"
      :popover-props="props.popoverProps"
      v-bind="$attrs"
      :data="tableData"
      :loading="computedLoading"
      @scroll-boundary="handleScrollBoundary"
      @select="scheduledSelect"
      @enter="handleEnter"
    >
      <template v-for="name in slotNames" #[name]="slotParams" :key="name">
        <slot :name="name" v-bind="slotParams" />
      </template>
      <template #footer>
        <ElPagination
          v-if="shouldShowPagination"
          class="mx-popover-table-select__pagination"
          :current-page="currentPage"
          :page-size="pageSize"
          :total="requestTotal"
          v-bind="paginationProps"
          @update:current-page="handleCurrentPageUpdate"
          @update:page-size="handlePageSizeUpdate"
        />
        <slot name="footer" />
      </template>
    </PopoverTableSelectBase>
    <ElInput
      v-if="props.popType === 'input'"
      ref="inputRef"
      v-bind="props.inputProps"
      v-model="currentInputValue"
      clearable
      :placeholder="computedPlaceholder"
      @focus="handleFocus"
      @blur="handleBlur"
      @input="scheduledInput"
      @clear="handleClear"
    />
  </div>
</template>

<style scoped>
.mx-popover-table-select {
  width: 100%;
}

.mx-popover-table-select__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
