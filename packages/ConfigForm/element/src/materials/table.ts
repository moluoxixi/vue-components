import type { Component, PropType } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { ElTable, ElTableColumn } from 'element-plus'
import { computed, defineComponent, h, ref, toRaw } from 'vue'

type DatasetItem = Record<string, unknown>

function itemKey(item: DatasetItem, index: number): string {
  const value = item.rowKey ?? index
  return `${typeof value}:${JSON.stringify(toRaw(value))}`
}

const ElementDatasetTable = defineComponent({
  name: 'ElementDatasetTable',
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
    const activate = (row: DatasetItem, index: number) => {
      selectedKey.value = itemKey(row, index)
      emit('row-click', structuredClone(toRaw(row)))
    }
    return () => {
      const columns = Object.keys(props.rows[0] ?? {}).filter(key => key !== 'rowKey')
      return h('section', { class: 'mx-element-dataset-table' }, [
        h(ElTable as unknown as Component, {
          data: props.rows,
          rowClassName: ({ row, rowIndex }: { row: DatasetItem, rowIndex: number }) => (
            selectedKey.value === itemKey(row, rowIndex) ? 'is-selected' : ''
          ),
          rowKey: (row: DatasetItem) => itemKey(row, props.rows.indexOf(row)),
          onRowClick: (row: DatasetItem) => activate(row, props.rows.indexOf(row)),
        }, () => columns.map(key => h(ElTableColumn, { key, prop: key, label: key }))),
        h('small', { class: 'mx-element-dataset-table__summary', role: 'status' }, `${props.rows.length} / ${total.value}`),
      ])
    }
  },
})

export default defineConfigFormComponentMaterial<Component>({
  name: 'table',
  order: 140,
  value: { component: ElementDatasetTable },
})
