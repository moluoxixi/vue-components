import type { Component, PropType } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { Table } from 'ant-design-vue'
import { computed, defineComponent, h, ref, toRaw } from 'vue'

type DatasetItem = Record<string, unknown>

function itemKey(item: DatasetItem, index: number): string {
  const value = item.rowKey ?? index
  return `${typeof value}:${JSON.stringify(toRaw(value))}`
}

const AntdDatasetTable = defineComponent({
  name: 'AntdDatasetTable',
  props: {
    rows: { type: Array as PropType<readonly DatasetItem[]>, default: () => [] },
    rowsTotal: Number,
  },
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
      return h('section', { class: 'mx-antd-dataset-table' }, [
        h(Table as unknown as Component, {
          columns,
          dataSource: props.rows,
          pagination: false,
          rowKey: (row: DatasetItem) => itemKey(row, props.rows.indexOf(row)),
          customRow: (row: DatasetItem, index = props.rows.indexOf(row)) => {
            const key = itemKey(row, index)
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
        h('small', { class: 'mx-antd-dataset-table__summary', role: 'status' }, `${props.rows.length} / ${total.value}`),
      ])
    }
  },
})

export default defineConfigFormComponentMaterial<Component>({
  name: 'table',
  order: 150,
  value: { component: AntdDatasetTable },
})
