// @vitest-environment happy-dom

import type { DatasetTableColumn } from '../types'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { useDatasetColumnLayout } from '../composables'

const wrappers: ReturnType<typeof mount>[] = []
function setup(scope = 'customers') {
  const columns = ref<DatasetTableColumn[]>([
    { key: 'id', kind: 'text', width: 160 },
    { key: 'name', kind: 'text', width: 220 },
    { key: 'notes', kind: 'text', width: 320 },
  ])
  let layout!: ReturnType<typeof useDatasetColumnLayout>
  const wrapper = mount(defineComponent({
    setup() {
      layout = useDatasetColumnLayout(computed(() => columns.value), () => scope)
      return () => h('div')
    },
  }))
  wrappers.push(wrapper)
  return { layout, columns }
}
beforeEach(() => localStorage.clear())
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('dataset column layout preferences', () => {
  it('remembers visibility, pinned order and keyboard widths per dataset without editing data', async () => {
    const { layout } = setup()
    layout.toggleVisible('notes')
    layout.pinned.value = 'name'
    layout.resizeWithKeyboard(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true }), layout.displayed.value[0]!)
    await nextTick()
    const reopened = setup().layout
    expect(reopened.displayed.value.map(column => [column.key, column.width])).toEqual([['name', 260], ['id', 160]])
    expect(setup('orders').layout.displayed.value).toHaveLength(3)
  })

  it('keeps one visible column and recovers from stale preferences when the dataset changes', () => {
    const { layout, columns } = setup()
    layout.toggleVisible('notes')
    layout.toggleVisible('name')
    layout.toggleVisible('id')
    expect(layout.displayed.value.map(column => column.key)).toEqual(['id'])
    columns.value = [{ key: 'name', kind: 'text', width: 200 }]
    expect(layout.displayed.value).toEqual(columns.value)
    expect(layout.hidden.value).toEqual([])
  })

  it('fits a resized column and resets visibility and pinned order independently', () => {
    const { layout } = setup()
    layout.resizeWithKeyboard(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true }), layout.displayed.value[0]!)
    expect(layout.displayed.value[0]!.width).toBe(120)
    layout.fit('id')
    expect(layout.displayed.value[0]!.width).toBe(160)
    layout.toggleVisible('notes')
    layout.pinned.value = 'name'
    layout.reset()
    expect(layout.displayed.value.map(column => column.key)).toEqual(['id', 'name', 'notes'])
    expect(layout.pinned.value).toBe('')
  })

  it('bounds pointer resizing and releases document interaction styles on unmount', () => {
    const { layout } = setup()
    layout.resize(new PointerEvent('pointerdown', { clientX: 200, button: 0 }), layout.displayed.value[0]!)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 2000 }))
    expect(layout.displayed.value[0]!.width).toBe(800)
    expect(document.body.style.cursor).toBe('col-resize')
    wrappers.pop()!.unmount()
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')
  })
})
