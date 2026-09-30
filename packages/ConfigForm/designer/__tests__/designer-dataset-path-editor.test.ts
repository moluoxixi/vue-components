import type { DatasetProjection, DatasetReference } from '@moluoxixi/config-form-model'
import { mount } from '@vue/test-utils'
import { ElCascader, ElInput, ElSelect } from 'element-plus'
import { afterEach, describe, expect, it } from 'vitest'
import DesignerDatasetBindingEditor from '../src/components/DesignerPropertyPanel/components/DesignerDataBindingEditor/components/DesignerDatasetBindingEditor/index.vue'

function createEditor(kind: DatasetProjection['kind'] = 'options', binding?: DatasetReference) {
  return mount(DesignerDatasetBindingEditor, {
    props: {
      binding,
      capability: { key: 'items', projectionKinds: [kind] },
      datasets: [{ id: 'items', name: 'Items', rows: [] }],
      hasInlineOptions: false,
      node: { id: 'choice', kind: 'field', component: 'test.choice', field: 'choice', props: {} },
      readonly: false,
    },
  })
}

const wrappers: ReturnType<typeof createEditor>[] = []
function editor(kind: DatasetProjection['kind'] = 'options', binding?: DatasetReference) {
  const wrapper = createEditor(kind, binding)
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

describe('dataset paths without inferred fields', () => {
  it('edits empty Dataset option and sort paths without splitting literal property names', async () => {
    const wrapper = editor()
    expect(wrapper.findAllComponents(ElCascader)).toHaveLength(0)
    expect(wrapper.get('[data-manual-dataset-path-help]').text()).toContain('JSON string array')
    await wrapper.get('input[aria-label="Label path"]').setValue('["profile.name","display/label"]')
    await wrapper.get('input[aria-label="Value path"]').setValue('["records","0"," key "]')
    await wrapper.get('button[aria-label="Add sort rule"]').trigger('click')
    await wrapper.get('input[aria-label="Sort path"]').setValue('["sort.by","排名"]')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')?.at(-1)?.[0]).toEqual({
      datasetId: 'items',
      projection: { kind: 'options', labelPath: ['profile.name', 'display/label'], valuePath: ['records', '0', ' key '] },
      query: { sort: [{ path: ['sort.by', '排名'], direction: 'asc' }] },
    })
  })

  it('edits empty Dataset table key and column paths', async () => {
    const wrapper = editor('table')
    await wrapper.get('input[aria-label="Row key path"]').setValue('["record","id"]')
    await wrapper.get('input[aria-label="Value path"]').setValue('["record","label.text"]')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')?.at(-1)?.[0]).toEqual({
      datasetId: 'items',
      projection: { kind: 'table', rowKeyPath: ['record', 'id'], columns: [{ key: 'label', valuePath: ['record', 'label.text'] }] },
    })
  })

  it('edits empty Dataset list paths and explicitly clears optional paths', async () => {
    const wrapper = editor('list', {
      datasetId: 'items',
      projection: { kind: 'list', itemKeyPath: ['id'], titlePath: ['title'], descriptionPath: ['description'] },
    })
    await wrapper.get('input[aria-label="Item key path"]').setValue('["record","id"]')
    await wrapper.get('input[aria-label="Title path"]').setValue('["record","title"]')
    await wrapper.get('input[aria-label="Description path"]').setValue('["record","description"]')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')?.at(-1)?.[0]).toMatchObject({
      projection: { kind: 'list', itemKeyPath: ['record', 'id'], titlePath: ['record', 'title'], descriptionPath: ['record', 'description'] },
    })
    await wrapper.get('input[aria-label="Title path"]').setValue('')
    await wrapper.get('input[aria-label="Description path"]').setValue('[]')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')?.at(-1)?.[0]).toEqual({
      datasetId: 'items',
      projection: { kind: 'list', itemKeyPath: ['record', 'id'] },
    })
  })

  it('clears an optional option disabled path', async () => {
    const wrapper = editor('options', {
      datasetId: 'items',
      projection: { kind: 'options', labelPath: ['label'], valuePath: ['value'], disabledPath: ['disabled'] },
    })
    await wrapper.get('input[aria-label="Disabled path"]').setValue('')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')?.at(-1)?.[0]).toEqual({
      datasetId: 'items',
      projection: { kind: 'options', labelPath: ['label'], valuePath: ['value'] },
    })
  })

  it.each([
    ['invalid JSON', '['],
    ['dotted string', 'profile.value'],
    ['non-array JSON', '{"path":"value"}'],
    ['empty required value', ''],
    ['empty required array', '[]'],
    ['empty segment', '[""]'],
    ['numeric segment', '[0]'],
    ['null segment', '[null]'],
    ['prototype key', '["__proto__"]'],
    ['constructor key', '["constructor"]'],
    ['prototype segment', '["record","prototype"]'],
    ['overlong segment', JSON.stringify(['x'.repeat(129)])],
    ['too many segments', JSON.stringify(Array.from({ length: 33 }).fill('item'))],
  ])('blocks %s and keeps the invalid draft until it is repaired', async (_label, draft) => {
    const wrapper = editor()
    const input = wrapper.get('input[aria-label="Value path"]')
    await input.setValue(draft)
    expect(input.attributes('aria-invalid')).toBe('true')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')).toBeUndefined()
    expect(wrapper.text()).toContain('Fix the invalid path before applying the binding.')
    expect((input.element as HTMLInputElement).value).toBe(draft)
    await input.setValue('["record","value"]')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')?.at(-1)?.[0]).toMatchObject({ projection: { valuePath: ['record', 'value'] } })
  })

  it('accepts the Model limits and repeated path segments', async () => {
    const wrapper = editor()
    const path = [...Array.from({ length: 31 }).fill('item'), 'x'.repeat(128)]
    await wrapper.get('input[aria-label="Value path"]').setValue(JSON.stringify(path))
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')?.at(-1)?.[0]).toMatchObject({ projection: { valuePath: path } })
  })

  it('blocks invalid optional paths instead of silently omitting them', async () => {
    const wrapper = editor()
    await wrapper.get('input[aria-label="Disabled path"]').setValue('["prototype"]')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')).toBeUndefined()
    await wrapper.get('input[aria-label="Disabled path"]').setValue('[]')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')).toHaveLength(1)
  })

  it('blocks invalid sort paths and removes their validation state with the rule', async () => {
    const wrapper = editor()
    await wrapper.get('button[aria-label="Add sort rule"]').trigger('click')
    await wrapper.get('input[aria-label="Sort path"]').setValue('["__proto__"]')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')).toBeUndefined()
    await wrapper.get('button[aria-label="Remove sort rule"]').trigger('click')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')?.at(-1)?.[0]).toEqual({
      datasetId: 'items',
      projection: { kind: 'options', labelPath: ['label'], valuePath: ['value'] },
    })
  })

  it('preserves invalid manual drafts when unrelated or newly inferred rows update', async () => {
    const wrapper = editor()
    await wrapper.get('input[aria-label="Value path"]').setValue('["draft')
    await wrapper.setProps({ datasets: [
      { id: 'items', name: 'Updated items', rows: [{ value: 'one', label: 'One' }] },
      { id: 'other', name: 'Other', rows: [] },
    ] })
    expect((wrapper.get('input[aria-label="Value path"]').element as HTMLInputElement).value).toBe('["draft')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it.each(['table', 'sort'] as const)('keeps an invalid %s path with its row when an earlier row is removed', async (kind) => {
    const wrapper = editor(kind === 'table' ? 'table' : 'options')
    const add = kind === 'table' ? 'Add column' : 'Add sort rule'
    const remove = kind === 'table' ? 'Remove column' : 'Remove sort rule'
    const path = kind === 'table' ? 'Value path' : 'Sort path'
    if (kind === 'sort')
      await wrapper.get(`button[aria-label="${add}"]`).trigger('click')
    await wrapper.get(`button[aria-label="${add}"]`).trigger('click')
    await wrapper.findAll(`input[aria-label="${path}"]`)[1].setValue('["unfinished')
    await wrapper.findAll(`button[aria-label="${remove}"]`)[0].trigger('click')
    expect((wrapper.get(`input[aria-label="${path}"]`).element as HTMLInputElement).value).toBe('["unfinished')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it.each(['table', 'sort'] as const)('preserves an invalid %s path when another field in its row changes', async (kind) => {
    const wrapper = editor(kind === 'table' ? 'table' : 'options')
    if (kind === 'sort')
      await wrapper.get('button[aria-label="Add sort rule"]').trigger('click')
    const path = kind === 'table' ? 'Value path' : 'Sort path'
    const input = wrapper.get(`input[aria-label="${path}"]`)
    await input.setValue('["unfinished')
    if (kind === 'table') {
      await wrapper.get('input[aria-label="Column key"]').setValue('renamed')
    }
    else {
      wrapper.get('[data-query-sort]').getComponent(ElSelect).vm.$emit('update:modelValue', 'desc')
      await wrapper.vm.$nextTick()
    }
    expect(wrapper.get(`input[aria-label="${path}"]`).element).toBe(input.element)
    expect((input.element as HTMLInputElement).value).toBe('["unfinished')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('resets invalid drafts when an authoritative binding replaces them', async () => {
    const wrapper = editor()
    await wrapper.get('input[aria-label="Value path"]').setValue('[')
    await wrapper.setProps({ binding: {
      datasetId: 'items',
      projection: { kind: 'options', labelPath: ['caption'], valuePath: ['identifier'] },
    } })
    expect((wrapper.get('input[aria-label="Value path"]').element as HTMLInputElement).value).toBe('["identifier"]')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')?.at(-1)?.[0]).toMatchObject({ projection: { valuePath: ['identifier'] } })
  })

  it('keeps structured pickers when Dataset fields can be inferred', async () => {
    const wrapper = editor()
    await wrapper.setProps({ datasets: [{ id: 'items', name: 'Items', rows: [{ label: 'One', value: 'one' }] }] })
    expect(wrapper.findAll('[data-manual-dataset-path]')).toHaveLength(0)
    const pickers = wrapper.findAllComponents(ElCascader)
    expect(pickers).toHaveLength(3)
    pickers[1].vm.$emit('change', ['label'])
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')?.at(-1)?.[0]).toMatchObject({ projection: { valuePath: ['label'] } })
  })

  it('disables manual editing and applying in readonly mode', async () => {
    const wrapper = editor()
    await wrapper.setProps({ readonly: true })
    expect(wrapper.get('input[aria-label="Value path"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-apply-dataset-binding]').attributes('disabled')).toBeDefined()
    const valueInput = wrapper.findAllComponents(ElInput).find(input => input.props('modelValue') === '["value"]')
    expect(valueInput).toBeDefined()
    valueInput?.vm.$emit('update:modelValue', '["changed"]')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')).toBeUndefined()
    await wrapper.setProps({ readonly: false })
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('apply')?.at(-1)?.[0]).toMatchObject({ projection: { valuePath: ['value'] } })
  })
})
