import type {
  ConfigFormDesignerExpose,
  DesignerDocument,
  DesignerFieldNode,
  DesignerMaterialDefinition,
} from '../index'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { ConfigFormDesigner, createDesignerLocale, createDesignerRegistry, designerDiagnostic } from '../index'

const sortableMock = vi.hoisted(() => ({
  create: vi.fn((element: HTMLElement, options: {
    onAdd?: (event: { item: HTMLElement, newIndex?: number }) => void
    onEnd?: (event: { item: HTMLElement, newIndex?: number, to: HTMLElement }) => void
    onStart?: () => void
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
      onStart?: () => void
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
    runtime: {
      component: 'input',
      valueProp: 'value',
      trigger: 'input',
      getValueFromEvent: event => (event as Event & { target: HTMLInputElement }).target.value,
    },
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

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440, writable: true })
})

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
    expect(columns.get('input').attributes('max')).toBe('24')
    await columns.get('button[aria-label="Increase Columns"]').trigger('click')
    expect(lastDocument(wrapper).form.columns).toBe(3)

    const fieldSpan = wrapper.findAll('.mx-config-form-designer__setter')
      .find(candidate => candidate.text().includes('Field span'))!
    expect(fieldSpan.get('input').attributes('max')).toBe('24')

    const inline = wrapper.findAll('.mx-config-form-designer__setter')
      .find(candidate => candidate.text().includes('Inline'))!
    await inline.get('button[role="switch"]').trigger('click')
    expect(lastDocument(wrapper).form.inline).toBe(true)
  })

  it('applies every form setting to the design canvas', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: {
        document: {
          ...twoFieldDocument(),
          form: {
            readonly: true,
            inline: false,
            columns: 2,
            gap: '12px',
            fieldSpan: 1,
            labelPosition: 'top',
          },
        },
        registry,
      },
    })

    const rootList = wrapper.get('.mx-config-form-designer__canvas-sheet > .mx-config-form-designer__node-list')
    expect(rootList.attributes('data-layout')).toBe('grid')
    expect(rootList.attributes('style')).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(rootList.attributes('style')).toContain('gap: 12px')
    expect(rootList.findAll(':scope > .mx-config-form-designer__node').every(node => node.attributes('style')?.includes('span 1'))).toBe(true)
    expect(rootList.findAll('.mx-config-form-designer__node-preview-readonly')).toHaveLength(2)
    expect(rootList.findAll('input')).toHaveLength(0)
    expect(rootList.findAll('.mx-config-form-designer__node-preview.is-label-top')).toHaveLength(2)

    const inline = wrapper.findAll('.mx-config-form-designer__setter')
      .find(candidate => candidate.text().includes('Inline'))!
    await inline.get('button[role="switch"]').trigger('click')

    const inlineRootList = wrapper.get('.mx-config-form-designer__canvas-sheet > .mx-config-form-designer__node-list')
    expect(inlineRootList.attributes('data-layout')).toBe('inline')
    expect(inlineRootList.attributes('style')).toContain('flex-wrap: wrap')
    expect(inlineRootList.attributes('style')).toContain('gap: 12px')
  })

  it('switches responsive canvas presets and edits overrides visually', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: {
        document: {
          ...twoFieldDocument(),
          form: {
            columns: 24,
            fieldSpan: 24,
            responsive: {
              tablet: { columns: 12, fieldSpan: 6 },
              mobile: { columns: 4, fieldSpan: 4 },
            },
          },
        },
        registry,
      },
    })

    const rootList = () => wrapper.get('.mx-config-form-designer__canvas-sheet > .mx-config-form-designer__node-list')
    expect(rootList().attributes('style')).toContain('repeat(24, minmax(0, 1fr))')
    expect(rootList().findAll(':scope > .mx-config-form-designer__node')[0]!.attributes('style')).toContain('span 24')

    await wrapper.get('button[aria-label="Tablet"]').trigger('click')
    expect(rootList().attributes('style')).toContain('repeat(12, minmax(0, 1fr))')
    expect(rootList().findAll(':scope > .mx-config-form-designer__node')[0]!.attributes('style')).toContain('span 6')

    await wrapper.get('button[aria-label="Mobile"]').trigger('click')
    expect(rootList().attributes('style')).toContain('repeat(4, minmax(0, 1fr))')
    expect(rootList().findAll(':scope > .mx-config-form-designer__node')[0]!.attributes('style')).toContain('span 4')

    const mobileLayout = wrapper.get('button[aria-label="Mobile layout"]')
    await mobileLayout.trigger('click')
    expect(lastDocument(wrapper).form.responsive).toEqual({
      tablet: { columns: 12, fieldSpan: 6 },
    })
  })

  it('lays out root spans as one full row followed by three equal columns', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: {
        document: {
          version: 1,
          form: { columns: 24, fieldSpan: 8 },
          nodes: [
            { id: 'full', kind: 'field', material: 'element.input', field: 'full', span: 24 },
            { id: 'left', kind: 'field', material: 'element.input', field: 'left', span: 8 },
            { id: 'middle', kind: 'field', material: 'element.input', field: 'middle', span: 8 },
            { id: 'right', kind: 'field', material: 'element.input', field: 'right', span: 8 },
          ],
        },
        registry,
      },
    })

    const rootList = wrapper.get('.mx-config-form-designer__canvas-sheet > .mx-config-form-designer__node-list')
    const rootNodes = rootList.findAll(':scope > .mx-config-form-designer__node')
    expect(rootList.classes()).toEqual(expect.arrayContaining(['mx-config-form__row', 'mx-config-form__row--grid']))
    expect(rootNodes.map(node => node.attributes('style'))).toEqual([
      expect.stringContaining('span 24 / span 24'),
      expect.stringContaining('span 8 / span 8'),
      expect.stringContaining('span 8 / span 8'),
      expect.stringContaining('span 8 / span 8'),
    ])
    expect(rootNodes.map(node => node.attributes('data-designer-span'))).toEqual(['24', '8', '8', '8'])
    expect(rootNodes.every(node => node.classes().includes('mx-config-form__cell'))).toBe(true)

    await rootNodes[0]!.get(':scope > .mx-config-form-designer__node-preview-shell').trigger('focus')
    expect(rootNodes[0]!.find(':scope > .mx-config-form-designer__node-actions').exists()).toBe(true)
    expect(rootNodes[0]!.find(':scope > .mx-config-form-designer__selection-overlay').exists()).toBe(false)
    expect(rootNodes[0]!.find(':scope > [data-designer-span-footprint]').exists()).toBe(false)
    expect(rootNodes[1]!.find(':scope > .mx-config-form-designer__node-actions').exists()).toBe(false)
  })

  it('projects container metadata and keeps one empty drop surface without nested chrome', () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: {
        document: {
          version: 1,
          form: {},
          nodes: [
            {
              id: 'empty-section',
              kind: 'container',
              material: 'element.section',
              slots: { default: [] },
            },
            {
              id: 'filled-section',
              kind: 'container',
              material: 'element.section',
              slots: {
                default: [{ id: 'nested-input', kind: 'field', material: 'element.input', field: 'nested' }],
              },
            },
          ],
        },
        registry,
      },
    })

    const emptySection = wrapper.get('[data-node-id="empty-section"]')
    expect(emptySection.attributes('data-material')).toBe('element.section')
    expect(emptySection.attributes('data-node-kind')).toBe('container')
    const emptyList = emptySection.get('.mx-config-form-designer__node-list[data-parent-id="empty-section"]')
    expect(emptyList.classes()).toContain('is-nested')
    expect(emptyList.attributes('data-parent-material')).toBe('element.section')
    expect(emptyList.attributes('data-slot')).toBe('default')
    expect(emptyList.findAll(':scope > .mx-config-form-designer__empty-slot')).toHaveLength(1)
    expect(emptyList.get(':scope > .mx-config-form-designer__empty-slot').text()).toBe('')
    expect(emptyList.get(':scope > .mx-config-form-designer__empty-slot svg').attributes('aria-hidden')).toBe('true')

    const filledSection = wrapper.get('[data-node-id="filled-section"]')
    const filledList = filledSection.get('.mx-config-form-designer__node-list[data-parent-id="filled-section"]')
    expect(filledList.findAll(':scope > .mx-config-form-designer__empty-slot')).toHaveLength(0)
    expect(filledList.get(':scope > [data-node-id="nested-input"]').attributes()).toMatchObject({
      'data-material': 'element.input',
      'data-node-kind': 'field',
    })
  })

  it('always previews linkage against an isolated model and gates only editing', async () => {
    const document: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [
        {
          id: 'controller',
          kind: 'field',
          material: 'element.input',
          field: 'controller',
          defaultValue: 'hide',
        },
        {
          id: 'dependent',
          kind: 'field',
          material: 'element.input',
          field: 'dependent',
          conditions: {
            visible: {
              kind: 'compare',
              operator: 'eq',
              left: { kind: 'field', field: 'controller' },
              right: { kind: 'literal', value: 'show' },
            },
          },
        },
      ],
    }
    const wrapper = mount(ConfigFormDesigner, { props: { document, registry } })
    const exposed = wrapper.vm as unknown as ConfigFormDesignerExpose
    const exportedBeforePreview = exposed.exportDocument()

    expect(wrapper.get('[data-node-id="dependent"]').attributes('style')).toContain('display: none')
    expect(wrapper.get('[data-node-id="controller"] .mx-config-form-designer__node-preview-control').attributes()).toHaveProperty('inert')
    await wrapper.get('button[aria-label="Linkage preview"]').trigger('click')
    expect(wrapper.get('[data-node-id="dependent"]').attributes('style')).toContain('display: none')

    const controller = wrapper.get('[data-node-id="controller"] input')
    await controller.setValue('show')
    expect(wrapper.get('[data-node-id="dependent"]').attributes('style') ?? '').not.toContain('display: none')
    expect(wrapper.emitted('update:document')).toBeUndefined()
    expect(exposed.exportDocument()).toBe(exportedBeforePreview)

    await wrapper.get('button[aria-label="Linkage preview"]').trigger('click')
    expect(wrapper.get('[data-node-id="dependent"]').attributes('style')).toContain('display: none')
    expect((wrapper.get('[data-node-id="controller"] input').element as HTMLInputElement).value).toBe('hide')

    expect(exposed.dispatch({
      type: 'updateNodePath',
      nodeId: 'controller',
      path: ['defaultValue'],
      value: 'show',
    })).toBe(true)
    await flushPromises()
    expect((wrapper.get('[data-node-id="controller"] input').element as HTMLInputElement).value).toBe('show')
    expect(wrapper.get('[data-node-id="dependent"]').attributes('style') ?? '').not.toContain('display: none')
  })

  it('activates linkage preview when a condition is edited', async () => {
    const document: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'enabled',
        kind: 'field',
        material: 'element.input',
        field: 'enabled',
        label: 'Enabled',
      }],
    }
    const wrapper = mount(ConfigFormDesigner, { props: { document, registry } })

    await wrapper.get('[data-node-id="enabled"] [data-focus-node-id="enabled"]').trigger('click')
    await wrapper.get('[role="tab"][aria-selected="false"]:last-child').trigger('click')
    const disabledSetter = wrapper.findAll('.mx-config-form-designer__setter')
      .find(setter => setter.text().includes('Disabled'))!
    await disabledSetter.findAll('button').find(button => button.text() === 'Always')!.trigger('click')

    expect(wrapper.get('button[aria-label="Linkage preview"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-node-id="enabled"] input').attributes('disabled')).toBeDefined()
    expect(lastDocument(wrapper).nodes[0]).toMatchObject({
      conditions: { disabled: { kind: 'literal', value: true } },
    })
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
    paletteSortables[0]!.options.onStart?.()
    expect(wrapper.get('.mx-config-form-designer').classes()).toContain('is-dragging')
    paletteSortables[0]!.options.onEnd?.({ item: document.createElement('button'), to: paletteSortables[0]!.element })
    expect(wrapper.get('.mx-config-form-designer').classes()).not.toContain('is-dragging')

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
    rootSortable!.options.onStart?.()
    expect(wrapper.get('.mx-config-form-designer').classes()).toContain('is-dragging')
    rootSortable!.options.onEnd?.({ item: second, newIndex: 0, to: rootSortable!.element })
    await flushPromises()
    expect(wrapper.get('.mx-config-form-designer').classes()).not.toContain('is-dragging')
    expect(lastDocument(wrapper).nodes.map(node => node.id)).toEqual(['second', 'first'])

    const material = document.createElement('button')
    material.dataset.materialKey = 'element.input'
    const refreshedRoot = [...sortableMock.instances].reverse().find(instance => instance.element.dataset.parentId === '' && instance.destroy.mock.calls.length === 0)
    refreshedRoot!.options.onAdd?.({ item: material, newIndex: 1 })
    await flushPromises()
    expect(lastDocument(wrapper).nodes).toHaveLength(3)
  })

  it('clears palette drag state when readonly tears down Sortable instances', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    await flushPromises()
    const paletteSortable = sortableMock.instances.find(instance => instance.element.classList.contains('mx-config-form-designer__palette-items'))
    expect(paletteSortable).toBeDefined()

    paletteSortable!.options.onStart?.()
    expect(wrapper.get('.mx-config-form-designer').classes()).toContain('is-dragging')
    await wrapper.setProps({ readonly: true })
    await flushPromises()
    expect(wrapper.get('.mx-config-form-designer').classes()).not.toContain('is-dragging')
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

  it('keeps documents editable while diagnostics block export and refresh reactively', async () => {
    const blocked = ref(true)
    const diagnosticMaterials: DesignerMaterialDefinition[] = materials.map(material => (
      material.key === 'element.input' && material.kind === 'field'
        ? {
            ...material,
            analyze: (node: DesignerFieldNode, path: (string | number)[]) => blocked.value
              ? [designerDiagnostic(
                  'DESIGNER_OPTION_SOURCE_LOADING',
                  'Options are still loading',
                  [...path, 'props', 'optionSource'],
                  'error',
                  node.id,
                )]
              : [],
          }
        : material
    ))
    const diagnosticRegistry = createDesignerRegistry([{ name: 'adapter', materials: diagnosticMaterials }])
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry: diagnosticRegistry },
    })
    const exposed = wrapper.vm as unknown as ConfigFormDesignerExpose

    expect(wrapper.find('[data-node-id="first"]').exists()).toBe(true)
    expect(exposed.dispatch({ type: 'updateForm', changes: { columns: 12 } })).toBe(true)
    expect(lastDocument(wrapper).form.columns).toBe(12)

    await wrapper.get('button[aria-label="Export document"]').trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toContain('Options are still loading')
    expect(wrapper.emitted('export')).toBeUndefined()
    const copy = wrapper.findAll('button').find(button => button.text().includes('Copy'))
    const download = wrapper.findAll('button').find(button => button.text().includes('Download'))
    expect(copy?.attributes('disabled')).toBeDefined()
    expect(download?.attributes('disabled')).toBeDefined()

    await wrapper.get('button[aria-label="Close"]').trigger('click')
    blocked.value = false
    await flushPromises()
    expect(wrapper.get('.mx-config-form-designer__status').text()).toContain('Ready')
  })
})
