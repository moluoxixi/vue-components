import type {
  ConfigFormDesignerExpose,
  DesignerDocument,
  DesignerMaterialDefinition,
} from '../index'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigFormDesigner, createDesignerLocale, createDesignerRegistry } from '../index'

const sortableMock = vi.hoisted(() => ({
  create: vi.fn((element: HTMLElement, options: {
    onAdd?: (event: { item: HTMLElement, newIndex?: number }) => void
    onEnd?: (event: { item: HTMLElement, newIndex?: number, to: HTMLElement }) => void
  }) => {
    const instance = { destroy: vi.fn(), element, options }
    sortableMock.instances.push(instance)
    return instance
  }),
  instances: [] as Array<{
    destroy: ReturnType<typeof vi.fn>
    element: HTMLElement
    options: {
      onAdd?: (event: { item: HTMLElement, newIndex?: number }) => void
      onEnd?: (event: { item: HTMLElement, newIndex?: number, to: HTMLElement }) => void
    }
  }>,
}))

vi.mock('sortablejs', () => ({
  default: { create: sortableMock.create },
}))

const materials: DesignerMaterialDefinition[] = [
  {
    key: 'element.input',
    version: 1,
    kind: 'field',
    title: 'Input',
    category: 'Fields',
    runtime: { component: 'input' },
    setters: [{
      key: 'placeholder',
      label: 'Placeholder',
      path: ['props', 'placeholder'],
      control: 'text',
    }],
    createNode: ({ id, field = 'input' }) => ({
      id,
      kind: 'field',
      material: 'element.input',
      field,
    }),
  },
  {
    key: 'element.section',
    version: 1,
    kind: 'container',
    title: 'Section',
    category: 'Layout',
    runtime: { component: 'section' },
    setters: [],
    slots: [{ name: 'default', title: 'Content' }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.section',
      slots: { default: [] },
    }),
  },
]

const registry = createDesignerRegistry([{ name: 'adapter', materials }])

function emptyDocument(): DesignerDocument {
  return { version: 1, form: {}, nodes: [] }
}

function twoFieldDocument(): DesignerDocument {
  return {
    version: 1,
    form: {},
    nodes: [
      { id: 'first', kind: 'field', material: 'element.input', field: 'first' },
      { id: 'second', kind: 'field', material: 'element.input', field: 'second' },
    ],
  }
}

function lastDocument(wrapper: ReturnType<typeof mount>): DesignerDocument {
  const event = wrapper.emitted('update:document')?.at(-1)
  if (!event)
    throw new Error('Expected update:document event')
  return event[0] as DesignerDocument
}

afterEach(() => {
  sortableMock.create.mockClear()
  sortableMock.instances.splice(0)
})

describe('config form designer', () => {
  it('localizes scalar and structured setter options without changing their values', () => {
    const locale = createDesignerLocale({
      materials: {
        'element.input': {
          options: {
            mode: {
              'row': '横向',
              '{"kind":"dense"}': '紧凑',
            },
          },
        },
      },
    })

    expect(locale.materialSetterOptionLabel(materials[0]!, 'mode', 'row', 'Row')).toBe('横向')
    expect(locale.materialSetterOptionLabel(materials[0]!, 'mode', { kind: 'dense' }, 'Dense')).toBe('紧凑')
  })

  it('reacts to locale replacements without changing document values', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: {
        document: emptyDocument(),
        registry,
        locale: {
          locale: 'zh-CN',
          messages: {
            'designer.title': '表单设计器',
            'palette.materials': '物料',
          },
          materials: {
            'element.input': {
              title: '输入框',
              category: '字段',
              setters: { placeholder: '占位文本' },
            },
          },
        },
      },
    })

    expect(wrapper.get('.mx-config-form-designer__toolbar').text()).toContain('表单设计器')
    expect(wrapper.get('.mx-config-form-designer__palette').attributes('aria-label')).toBe('物料')
    expect(wrapper.get('[data-material-key="element.input"]').text()).toContain('输入框')

    await wrapper.get('[data-material-key="element.input"]').trigger('click')
    expect(wrapper.findAll('.mx-config-form-designer__setter').some(setter => setter.text().includes('占位文本'))).toBe(true)
    expect(lastDocument(wrapper).nodes[0]).toMatchObject({ material: 'element.input', field: 'input' })

    await wrapper.setProps({
      locale: {
        locale: 'en-US',
        messages: {
          'designer.title': 'Localized designer',
          'palette.materials': 'Localized materials',
        },
        materials: {
          'element.input': {
            title: 'Localized input',
            category: 'Localized fields',
            setters: { placeholder: 'Localized placeholder' },
          },
        },
      },
    })

    expect(wrapper.get('.mx-config-form-designer__toolbar').text()).toContain('Localized designer')
    expect(wrapper.get('.mx-config-form-designer__palette').attributes('aria-label')).toBe('Localized materials')
    expect(wrapper.get('[data-material-key="element.input"]').text()).toContain('Localized input')
    expect(wrapper.findAll('.mx-config-form-designer__setter').some(setter => setter.text().includes('Localized placeholder'))).toBe(true)
    expect(lastDocument(wrapper).nodes[0]).toMatchObject({ material: 'element.input', field: 'input' })
  })

  it('updates the form label position through the form property setter', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: emptyDocument(), registry },
    })

    const setter = wrapper.findAll('.mx-config-form-designer__setter')
      .find(candidate => candidate.text().includes('Label position'))
    const top = setter!.findAll('button').find(button => button.text() === 'Top')
    await top!.trigger('click')

    expect(lastDocument(wrapper).form.labelPosition).toBe('top')
  })

  it('uses direct manipulation controls for boolean and numeric form settings', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: {
        document: { ...emptyDocument(), form: { columns: 2, inline: false } },
        registry,
      },
    })

    const columns = wrapper.findAll('.mx-config-form-designer__setter')
      .find(candidate => candidate.text().includes('Columns'))!
    await columns.get('button[aria-label="Increase Columns"]').trigger('click')
    expect(lastDocument(wrapper).form.columns).toBe(3)

    const inline = wrapper.findAll('.mx-config-form-designer__setter')
      .find(candidate => candidate.text().includes('Inline'))!
    await inline.get('button[role="switch"]').trigger('click')
    expect(lastDocument(wrapper).form.inline).toBe(true)
  })

  it('adds materials, commits text on blur, and preserves undo/redo boundaries', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      attachTo: document.body,
      props: { document: emptyDocument(), registry },
    })
    await flushPromises()

    const paletteSortables = sortableMock.instances.filter(instance => instance.element.classList.contains('mx-config-form-designer__palette-items'))
    expect(paletteSortables).toHaveLength(2)
    expect(paletteSortables.every(instance => [...instance.element.children]
      .every(child => (child as HTMLElement).hasAttribute('data-designer-draggable')))).toBe(true)

    await wrapper.get('[data-material-key="element.input"]').trigger('click')
    await flushPromises()
    expect(lastDocument(wrapper).nodes).toHaveLength(1)
    expect(lastDocument(wrapper).nodes[0]).toMatchObject({ field: 'input' })

    const labelSetter = wrapper.findAll('.mx-config-form-designer__setter')
      .find(setter => setter.text().includes('Label'))
    const labelInput = labelSetter?.find('input')
    expect(labelInput?.exists()).toBe(true)
    const updateCount = wrapper.emitted('update:document')?.length
    await labelInput!.setValue('Display name')
    expect(wrapper.emitted('update:document')).toHaveLength(updateCount!)
    await labelInput!.trigger('blur')
    expect(lastDocument(wrapper).nodes[0]).toMatchObject({ label: 'Display name' })

    await wrapper.get('button[aria-label="Undo"]').trigger('click')
    expect(lastDocument(wrapper).nodes[0]).not.toHaveProperty('label')
    await wrapper.get('button[aria-label="Redo"]').trigger('click')
    expect(lastDocument(wrapper).nodes[0]).toMatchObject({ label: 'Display name' })

    wrapper.unmount()
    expect(sortableMock.instances.length).toBeGreaterThan(0)
    expect(sortableMock.instances.every(instance => instance.destroy.mock.calls.length > 0)).toBe(true)
  })

  it('treats external document changes as a fresh history baseline', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: emptyDocument(), registry },
    })
    await wrapper.get('[data-material-key="element.input"]').trigger('click')
    expect(wrapper.get('button[aria-label="Undo"]').attributes('disabled')).toBeUndefined()

    await wrapper.setProps({
      document: {
        version: 1,
        form: { columns: 2 },
        nodes: [{
          id: 'external',
          kind: 'field',
          material: 'element.input',
          field: 'external',
        }],
      },
    })
    await flushPromises()

    expect(wrapper.get('[data-node-id="external"] [data-focus-node-id="external"]').attributes('aria-label')).toBe('Select external')
    expect(wrapper.get('button[aria-label="Undo"]').attributes('disabled')).toBeDefined()
  })

  it('routes keyboard moves and compound validation edits through semantic commands', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    await flushPromises()

    const second = wrapper.get('[data-focus-node-id="second"]')
    await second.trigger('focus')
    await second.trigger('keydown', { key: 'ArrowUp' })
    expect(lastDocument(wrapper).nodes.map(node => node.id)).toEqual(['second', 'first'])

    await wrapper.get('button[role="tab"]:nth-of-type(2)').trigger('click')
    const validation = wrapper.get('.mx-config-form-designer__validation-editor')
    await validation.get('button[role="switch"]').trigger('click')
    await validation.get('.mx-config-form-designer__add-row').trigger('click')
    await validation.get('.mx-config-form-designer__rule-row select').setValue('required')
    const message = validation.get('input[aria-label="Rule 1 message"]')
    await message.setValue('Required')
    await message.trigger('blur')
    expect(lastDocument(wrapper).nodes[0]).toMatchObject({
      validation: {
        version: 1,
        rules: [{ kind: 'required', message: 'Required' }],
      },
    })
  })

  it('translates Sortable callbacks into add and move commands', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    await flushPromises()
    const rootSortable = sortableMock.instances.find(instance => instance.element.dataset.parentId === '')
    expect(rootSortable).toBeDefined()

    const second = wrapper.get('[data-node-id="second"]').element as HTMLElement
    rootSortable!.options.onEnd?.({ item: second, newIndex: 0, to: rootSortable!.element })
    await flushPromises()
    expect(lastDocument(wrapper).nodes.map(node => node.id)).toEqual(['second', 'first'])

    const material = document.createElement('button')
    material.dataset.materialKey = 'element.input'
    const refreshedRoot = [...sortableMock.instances].reverse().find(instance => instance.element.dataset.parentId === '' && instance.destroy.mock.calls.length === 0)
    refreshedRoot!.options.onAdd?.({ item: material, newIndex: 1 })
    await flushPromises()
    expect(lastDocument(wrapper).nodes).toHaveLength(3)
  })

  it('restores document-rendered DOM after an invalid Sortable target', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    await flushPromises()
    const rootSortable = sortableMock.instances.find(instance => instance.element.dataset.parentId === '')
    const second = wrapper.get('[data-node-id="second"]').element as HTMLElement
    const invalidTarget = document.createElement('ol')
    invalidTarget.dataset.parentId = 'missing'
    invalidTarget.dataset.slot = 'default'
    invalidTarget.append(second)
    rootSortable!.options.onEnd?.({ item: second, newIndex: 0, to: invalidTarget })
    await flushPromises()

    const rootList = wrapper.get('[data-parent-id=""]').element
    expect([...rootList.children].some(child => (child as HTMLElement).dataset.nodeId === 'second')).toBe(true)
    expect(wrapper.emitted('update:document')).toBeUndefined()
  })

  it('keeps readonly public methods inert and tolerates invalid history limits', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: {
        document: emptyDocument(),
        registry,
        readonly: true,
        historyLimit: 0,
      },
    })
    const exposed = wrapper.vm as unknown as ConfigFormDesignerExpose
    expect(exposed.importDocument(twoFieldDocument())).toBe(false)
    expect(exposed.dispatch({
      type: 'updateForm',
      changes: { columns: 2 },
    })).toBe(false)
    expect(wrapper.emitted('update:document')).toBeUndefined()
  })

  it('imports, exports, and opens preview only for compilable documents', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    await wrapper.get('button[aria-label="Export document"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('Export document')
    expect(wrapper.emitted('export')).toHaveLength(1)
    await wrapper.get('button[aria-label="Close"]').trigger('click')

    await wrapper.get('button[aria-label="Preview form"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('Form preview')
    expect(wrapper.emitted('preview')).toHaveLength(1)
  })
})
