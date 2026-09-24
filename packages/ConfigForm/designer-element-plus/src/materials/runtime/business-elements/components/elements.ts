import type { Component, PropType } from 'vue'
import {
  ElAlert,
  ElButton,
  ElDivider,
  ElEmpty,
  ElIcon,
  ElImage,
  ElLink,
  ElPagination,
  ElTable,
  ElTableColumn,
  ElTag,
  ElText,
} from 'element-plus'
import { computed, defineComponent, h, ref, toRaw } from 'vue'

type DatasetItem = Record<string, unknown>

const itemRows = {
  type: Array as PropType<readonly DatasetItem[]>,
  default: () => [],
}

function itemKey(item: DatasetItem, key: 'itemKey' | 'rowKey', index: number): string {
  const value = item[key] ?? index
  return `${typeof value}:${JSON.stringify(toRaw(value))}`
}

export const ElementDisplayText = defineComponent({
  name: 'ElementDisplayText',
  props: { text: { type: String, default: 'Text' }, type: { type: String, default: 'primary' } },
  setup: props => () => h(ElText, { type: props.type as never }, () => props.text),
})

export const ElementDisplayTitle = defineComponent({
  name: 'ElementDisplayTitle',
  props: { text: { type: String, default: 'Title' }, level: { type: Number, default: 2 } },
  setup: props => () => h(`h${Math.min(6, Math.max(1, props.level))}`, { class: 'el-business-title' }, props.text),
})

export const ElementDisplayIcon = defineComponent({
  name: 'ElementDisplayIcon',
  setup: () => () => h(ElIcon, { size: 18 }, () => h('span', 'i')),
})

export const ElementDisplayDivider = defineComponent({
  name: 'ElementDisplayDivider',
  props: { text: { type: String, default: '' } },
  setup: props => () => h(ElDivider, {}, () => props.text),
})

export const ElementDisplayButton = defineComponent({
  name: 'ElementDisplayButton',
  props: { text: { type: String, default: 'Button' }, type: { type: String, default: 'primary' } },
  emits: ['click'],
  setup: (props, { emit }) => () => h(ElButton, { type: props.type as never, onClick: () => emit('click') }, () => props.text),
})

export const ElementDisplayLink = defineComponent({
  name: 'ElementDisplayLink',
  props: { text: { type: String, default: 'Link' }, type: { type: String, default: 'primary' } },
  emits: ['click'],
  setup: (props, { emit }) => () => h(ElLink, { type: props.type as never, onClick: () => emit('click') }, () => props.text),
})

export const ElementDisplayTag = defineComponent({
  name: 'ElementDisplayTag',
  props: { text: { type: String, default: 'Tag' }, type: { type: String, default: 'info' } },
  setup: props => () => h(ElTag, { type: props.type as never }, () => props.text),
})

export const ElementDatasetTable = defineComponent({
  name: 'ElementDatasetTable',
  props: { rows: itemRows, rowsTotal: Number },
  emits: ['row-click'],
  setup(props, { emit }) {
    const selectedKey = ref<string>()
    const total = computed(() => Number.isInteger(props.rowsTotal) && (props.rowsTotal ?? -1) >= 0
      ? props.rowsTotal!
      : props.rows.length)
    return () => {
      const columns = Object.keys(props.rows[0] ?? {}).filter(key => key !== 'rowKey')
      return h('section', { class: 'el-business-table' }, [
        h(ElTable as unknown as Component, {
          data: props.rows,
          rowClassName: ({ row, rowIndex }: { row: DatasetItem, rowIndex: number }) => (
            selectedKey.value === itemKey(row, 'rowKey', rowIndex) ? 'is-selected' : ''
          ),
          rowKey: (row: DatasetItem) => itemKey(row, 'rowKey', props.rows.indexOf(row)),
          onRowClick: (row: DatasetItem) => {
            selectedKey.value = itemKey(row, 'rowKey', props.rows.indexOf(row))
            emit('row-click', structuredClone(toRaw(row)))
          },
        }, () => columns.map(key => h(ElTableColumn, { key, prop: key, label: key }))),
        h('small', { class: 'el-business-table__summary', role: 'status' }, `${props.rows.length} / ${total.value}`),
      ])
    }
  },
})

export const ElementDatasetList = defineComponent({
  name: 'ElementDatasetList',
  props: { items: itemRows, itemsTotal: Number },
  emits: ['item-click'],
  setup(props, { emit }) {
    const selectedKey = ref<string>()
    const total = computed(() => Number.isInteger(props.itemsTotal) && (props.itemsTotal ?? -1) >= 0
      ? props.itemsTotal!
      : props.items.length)
    return () => h('section', { class: 'el-business-list' }, [
      h('div', { class: 'el-business-list__items', role: 'list' }, props.items.map((item, index) => {
        const key = itemKey(item, 'itemKey', index)
        const selected = selectedKey.value === key
        return h('button', {
          'key': key,
          'aria-pressed': selected,
          'class': ['el-business-list__item', selected && 'is-selected'],
          'type': 'button',
          'onClick': () => {
            selectedKey.value = key
            emit('item-click', structuredClone(toRaw(item)))
          },
        }, [
          h('strong', String(item.title ?? item.itemKey ?? '')),
          item.description === undefined || item.description === null
            ? undefined
            : h('span', String(item.description)),
        ])
      })),
      h('small', { class: 'el-business-list__summary', role: 'status' }, `${props.items.length} / ${total.value}`),
    ])
  },
})

export const ElementDisplayImage = ElImage
export const ElementDisplayAlert = ElAlert
export const ElementDisplayEmpty = ElEmpty
export const ElementDisplayPagination = ElPagination
