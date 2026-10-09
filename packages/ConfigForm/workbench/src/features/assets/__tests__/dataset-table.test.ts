// @vitest-environment happy-dom

import type { ModelJsonObject } from '@moluoxixi/config-form-model'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import DatasetTableEditor from '../components/DatasetTableEditor.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.innerHTML = ''
})

function setup(rows: ModelJsonObject[]) {
  const overlays = document.createElement('div')
  overlays.id = 'workbench-overlays'
  document.body.append(overlays)
  const json = ref(JSON.stringify(rows, null, 2))
  const cells = ref<Record<string, string>>({})
  const save = vi.fn()
  const wrapper = mount(defineComponent({
    setup: () => () => h(DatasetTableEditor, {
      'json': json.value,
      'cells': cells.value,
      'locale': 'en-US',
      'onUpdate:json': (value: string) => { json.value = value },
      'onUpdate:cells': (value: Record<string, string>) => { cells.value = value },
      'onSave': save,
    }),
  }), { attachTo: document.body })
  wrappers.push(wrapper)
  const cell = (row: number, key: string) => wrapper.get(`button[aria-label="${row} / ${key}"]`)
  const button = (label: string) => wrapper.findAll('button').find(button => button.text() === label)!
  return { wrapper, cell, button, json, cells, save }
}

describe('dataset reading and editing', () => {
  it('distinguishes empty, null and missing values and opens complete, formatted content without dirtying the draft', async () => {
    const { wrapper, cell, cells } = setup([
      { name: '林知夏', blank: '', nullable: null, active: false, meta: { city: '杭州', tags: ['priority'] } },
      { name: 'Alice' },
    ])
    expect(wrapper.find('[data-asset-dataset-table] input').exists()).toBe(false)
    expect(cell(1, 'blank').text()).toBe('Empty string')
    expect(cell(1, 'nullable').text()).toBe('null')
    expect(cell(2, 'nullable').text()).toBe('Not set')
    expect(cell(1, 'active').text()).toBe('false')
    await cell(1, 'meta').trigger('click')
    expect(wrapper.get('[data-dataset-full-value]').text()).toBe(JSON.stringify({ city: '杭州', tags: ['priority'] }, null, 2))
    expect(cells.value).toEqual({})
    await cell(1, 'name').trigger('keydown', { key: 'F2' })
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('textarea').element)
  })

  it('sorts numbers correctly and edits the original row after sorting and filtering', async () => {
    const { wrapper, cell, json, save } = setup([{ id: '001', amount: 100 }, { id: '002', amount: 2 }, { id: '003', amount: null }])
    await wrapper.get('button[aria-label="Sort by amount"]').trigger('click')
    expect(wrapper.findAll('tbody th').map(row => row.text())).toEqual(['2', '1', '3'])
    await cell(2, 'amount').trigger('dblclick')
    await wrapper.get('textarea').setValue('12')
    await wrapper.get('input[aria-label="Filter rows"]').setValue('002')
    expect(wrapper.findAll('tbody th').map(row => row.text())).toEqual(['2'])
    await wrapper.get('[data-dataset-table-save]').trigger('click')
    await flushPromises()
    expect(JSON.parse(json.value)).toEqual([{ id: '001', amount: 100 }, { id: '002', amount: 12 }, { id: '003', amount: null }])
    expect(save).toHaveBeenCalledOnce()
  })

  it('keeps invalid input for correction and validates nested JSON before clearing any draft', async () => {
    const { wrapper, cell, cells, json, save } = setup([{ amount: 2, meta: { label: 'A' } }])
    await cell(1, 'amount').trigger('dblclick')
    await wrapper.get('textarea').setValue('NaN')
    await wrapper.get('[data-dataset-table-save]').trigger('click')
    expect(wrapper.text()).toContain('Enter a finite number')
    expect(cells.value).toEqual({ '[0,"amount"]': 'NaN' })
    expect(save).not.toHaveBeenCalled()
    await wrapper.get('textarea').setValue('3')
    await cell(1, 'meta').trigger('dblclick')
    await wrapper.get('textarea').setValue('{"constructor": {"unsafe": true}}')
    await wrapper.get('[data-dataset-table-save]').trigger('click')
    expect(save).not.toHaveBeenCalled()
    expect(Object.keys(cells.value)).toHaveLength(2)
    expect(JSON.parse(json.value)).toEqual([{ amount: 2, meta: { label: 'A' } }])
    await wrapper.get('textarea').setValue('{"label":"B","tags":[null,1]}')
    await wrapper.get('[data-dataset-table-save]').trigger('click')
    await flushPromises()
    expect(JSON.parse(json.value)).toEqual([{ amount: 3, meta: { label: 'B', tags: [null, 1] } }])
    expect(cells.value).toEqual({})
  })

  it('searches pending values, reverts individual edits, and resets filtering to page one', async () => {
    const { wrapper, cell, button, cells } = setup(Array.from({ length: 30 }, (_, index) => ({ id: String(index).padStart(3, '0'), name: `Name ${index}` })))
    await wrapper.get('button[aria-label="Next page"]').trigger('click')
    expect(wrapper.findAll('tbody th').map(row => row.text())).toEqual(['26', '27', '28', '29', '30'])
    await cell(30, 'name').trigger('dblclick')
    await wrapper.get('textarea').setValue('Pending customer')
    await wrapper.get('input[aria-label="Filter rows"]').setValue('pending')
    expect(wrapper.findAll('tbody th').map(row => row.text())).toEqual(['30'])
    expect(wrapper.get('.dataset-table-range').text()).toContain('1–1 / 1 rows')
    await button('Revert cell').trigger('click')
    expect(cells.value).toEqual({})
    expect(wrapper.get('.dataset-table-empty').text()).toContain('No matching rows')
    await button('Clear filter').trigger('click')
    expect(wrapper.findAll('tbody th')).toHaveLength(25)
  })
})
