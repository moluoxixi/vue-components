import type { Component, PropType } from 'vue'
import { defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { computed, defineComponent, h, ref, toRaw } from 'vue'

type DatasetItem = Record<string, unknown>

function itemKey(item: DatasetItem, index: number): string {
  const value = item.itemKey ?? index
  return `${typeof value}:${JSON.stringify(toRaw(value))}`
}

const AntdDatasetList = defineComponent({
  name: 'AntdDatasetList',
  props: {
    items: { type: Array as PropType<readonly DatasetItem[]>, default: () => [] },
    itemsTotal: Number,
  },
  emits: ['item-click'],
  setup(props, { emit }) {
    const selectedKey = ref<string>()
    const total = computed(() => Number.isInteger(props.itemsTotal) && (props.itemsTotal ?? -1) >= 0
      ? props.itemsTotal!
      : props.items.length)
    return () => h('section', { class: 'mx-antd-dataset-list' }, [
      h('div', { class: 'mx-antd-dataset-list__items', role: 'list' }, props.items.map((item, index) => {
        const key = itemKey(item, index)
        const selected = selectedKey.value === key
        return h('button', {
          'key': key,
          'aria-pressed': selected,
          'class': ['mx-antd-dataset-list__item', selected && 'is-selected'],
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
      h('small', { class: 'mx-antd-dataset-list__summary', role: 'status' }, `${props.items.length} / ${total.value}`),
    ])
  },
})

export default defineConfigFormComponentMaterial<Component>({
  name: 'list',
  order: 160,
  value: { component: AntdDatasetList },
})
