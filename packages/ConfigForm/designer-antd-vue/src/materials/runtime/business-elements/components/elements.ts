import type { Component, PropType } from 'vue'
import {
  Alert,
  Button,
  Divider,
  Empty,
  Image,
  Pagination,
  Table,
  Tag,
  TypographyLink,
  TypographyText,
  TypographyTitle,
} from 'ant-design-vue'
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

export const AntdDisplayText = defineComponent({
  name: 'AntdDisplayText',
  props: { text: { type: String, default: 'Text' }, type: { type: String, default: undefined } },
  setup: props => () => h(TypographyText, { type: props.type as never }, () => props.text),
})

export const AntdDisplayTitle = defineComponent({
  name: 'AntdDisplayTitle',
  props: { text: { type: String, default: 'Title' }, level: { type: Number, default: 2 } },
  setup: props => () => h(TypographyTitle, { level: Math.min(5, Math.max(1, props.level)) as never }, () => props.text),
})

export const AntdDisplayIcon = defineComponent({
  name: 'AntdDisplayIcon',
  setup: () => () => h('span', { 'class': 'anticon', 'aria-hidden': 'true' }, 'i'),
})

export const AntdDisplayDivider = defineComponent({
  name: 'AntdDisplayDivider',
  props: { text: { type: String, default: '' } },
  setup: props => () => h(Divider, {}, () => props.text),
})

export const AntdDisplayButton = defineComponent({
  name: 'AntdDisplayButton',
  props: { text: { type: String, default: 'Button' }, type: { type: String, default: 'primary' } },
  emits: ['click'],
  setup: (props, { emit }) => () => h(Button, { type: props.type as never, onClick: () => emit('click') }, () => props.text),
})

export const AntdDisplayLink = defineComponent({
  name: 'AntdDisplayLink',
  props: { text: { type: String, default: 'Link' } },
  emits: ['click'],
  setup: (props, { emit }) => () => h(TypographyLink, { onClick: () => emit('click') }, () => props.text),
})

export const AntdDisplayTag = defineComponent({
  name: 'AntdDisplayTag',
  props: { text: { type: String, default: 'Tag' } },
  setup: props => () => h(Tag, {}, () => props.text),
})

export const AntdDatasetTable = defineComponent({
  name: 'AntdDatasetTable',
  props: { rows: itemRows, rowsTotal: Number },
  emits: ['row-click'],
  setup(props, { emit }) {
    const selectedKey = ref<string>()
    const total = computed(() => Number.isInteger(props.rowsTotal) && (props.rowsTotal ?? -1) >= 0
      ? props.rowsTotal!
      : props.rows.length)
    return () => {
      const columns = Object.keys(props.rows[0] ?? {})
        .filter(key => key !== 'rowKey')
        .map(key => ({ title: key, dataIndex: key, key }))
      return h('section', { class: 'antd-business-table' }, [
        h(Table as unknown as Component, {
          dataSource: props.rows,
          columns,
          pagination: false,
          rowKey: (row: DatasetItem) => itemKey(row, 'rowKey', props.rows.indexOf(row)),
          customRow: (row: DatasetItem, index = props.rows.indexOf(row)) => {
            const key = itemKey(row, 'rowKey', index)
            return {
              'aria-selected': selectedKey.value === key,
              'class': selectedKey.value === key ? 'is-selected' : '',
              'onClick': () => {
                selectedKey.value = key
                emit('row-click', structuredClone(toRaw(row)))
              },
            }
          },
        }),
        h('small', { class: 'antd-business-table__summary', role: 'status' }, `${props.rows.length} / ${total.value}`),
      ])
    }
  },
})

export const AntdDatasetList = defineComponent({
  name: 'AntdDatasetList',
  props: { items: itemRows, itemsTotal: Number },
  emits: ['item-click'],
  setup(props, { emit }) {
    const selectedKey = ref<string>()
    const total = computed(() => Number.isInteger(props.itemsTotal) && (props.itemsTotal ?? -1) >= 0
      ? props.itemsTotal!
      : props.items.length)
    return () => h('section', { class: 'antd-business-list' }, [
      h('div', { class: 'antd-business-list__items', role: 'list' }, props.items.map((item, index) => {
        const key = itemKey(item, 'itemKey', index)
        const selected = selectedKey.value === key
        return h('button', {
          'key': key,
          'aria-pressed': selected,
          'class': ['antd-business-list__item', selected && 'is-selected'],
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
      h('small', { class: 'antd-business-list__summary', role: 'status' }, `${props.items.length} / ${total.value}`),
    ])
  },
})

export const AntdDisplayImage: Component = Image
export const AntdDisplayAlert = defineComponent({
  name: 'AntdDisplayAlert',
  props: {
    title: { type: String, default: 'Alert' },
    description: { type: String, default: '' },
    type: { type: String, default: 'info' },
    showIcon: { type: Boolean, default: true },
  },
  setup: props => () => h(Alert, {
    message: props.title,
    description: props.description,
    type: props.type as never,
    showIcon: props.showIcon,
  }),
})
export const AntdDisplayEmpty: Component = Empty
export const AntdDisplayPagination: Component = Pagination
