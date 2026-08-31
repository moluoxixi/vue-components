import type {
  ConfigFormDesignerExpose,
  DesignerDocument,
  DesignerFieldNode,
  DesignerMaterialDefinition,
  DesignSurfaceExpose,
} from '../index'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import {
  ConfigFormDesigner,
  createDesignerLocale,
  createDesignerRegistry,
  createDesignerRuntimeProjection,
  createLowCodeComponentRegistry,
  designerDiagnostic,
  designerDocumentToConfigModel,
  DesignSurface,
} from '../index'

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
    source: { configComponent: 'text', render: 'component', tag: 'input' },
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
    source: { configComponent: 'div', render: 'section', tag: 'section' },
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
  vi.unstubAllGlobals()
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
    expect(wrapper.get('[data-material-key="element.input"]').attributes('aria-label')).toBe('输入框')
    expect(wrapper.get('[data-material-row-key="element.input"]').text()).toContain('输入框')

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
    expect(wrapper.get('[data-material-key="element.input"]').attributes('aria-label')).toBe('Localized input')
    expect(wrapper.get('[data-material-row-key="element.input"]').text()).toContain('Localized input')
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

    const rootList = wrapper.get('.mx-config-form-designer__runtime-surface [data-config-form-responsive-layout]')
    expect(rootList.classes()).toContain('mx-config-form__row--grid')
    expect(rootList.attributes('style')).toContain('--mx-config-form-columns-desktop: 2')
    expect(rootList.attributes('style')).toContain('gap: 12px')
    expect(rootList.findAll(':scope > [data-config-node-id]').every(node => node.attributes('style')?.includes('--mx-config-form-span-desktop: 1'))).toBe(true)
    expect(rootList.findAll('.mx-config-form__readonly')).toHaveLength(2)
    expect(rootList.findAll('input')).toHaveLength(0)
    expect(rootList.findAll('.mx-config-form__field--label-top')).toHaveLength(2)

    const inline = wrapper.findAll('.mx-config-form-designer__setter')
      .find(candidate => candidate.text().includes('Inline'))!
    await inline.get('button[role="switch"]').trigger('click')

    const inlineRootList = wrapper.get('.mx-config-form-designer__runtime-surface .mx-config-form__row--inline')
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

    const rootList = () => wrapper.get('.mx-config-form-designer__runtime-surface [data-config-form-responsive-layout]')
    expect(rootList().attributes('style')).toContain('--mx-config-form-columns-desktop: 24')
    expect(rootList().findAll(':scope > [data-config-node-id]')[0]!.attributes('style')).toContain('--mx-config-form-span-desktop: 24')

    await wrapper.get('button[aria-label="Tablet"]').trigger('click')
    expect(wrapper.get('.mx-config-form-designer__canvas-sheet').attributes('data-sheet-breakpoint')).toBe('tablet')
    expect(rootList().attributes('style')).toContain('--mx-config-form-columns-tablet: 12')
    expect(rootList().findAll(':scope > [data-config-node-id]')[0]!.attributes('style')).toContain('--mx-config-form-span-tablet: 6')

    await wrapper.get('button[aria-label="Mobile"]').trigger('click')
    expect(wrapper.get('.mx-config-form-designer__canvas-sheet').attributes('data-sheet-breakpoint')).toBe('mobile')
    expect(rootList().attributes('style')).toContain('--mx-config-form-columns-mobile: 4')
    expect(rootList().findAll(':scope > [data-config-node-id]')[0]!.attributes('style')).toContain('--mx-config-form-span-mobile: 4')

    const mobileLayout = wrapper.get('button[aria-label="Mobile layout"]')
    await mobileLayout.trigger('click')
    expect(lastDocument(wrapper).form.responsive).toEqual({
      tablet: { columns: 12, fieldSpan: 6 },
    })
  })

  it('keeps intrinsic frame widths separate from transient canvas camera state', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    const viewport = wrapper.get('[data-canvas-camera-viewport]')
    ;(viewport.element as HTMLElement).style.padding = '0'
    Object.defineProperty(viewport.element, 'clientWidth', { configurable: true, value: 450 })

    await wrapper.get('button[aria-label="Fit canvas"]').trigger('click')
    const canvas = wrapper.get('.mx-config-form-designer__canvas')
    const sheet = wrapper.get('.mx-config-form-designer__canvas-sheet')
    expect(sheet.attributes()).toMatchObject({
      'data-intrinsic-width': '900',
      'data-sheet-breakpoint': 'desktop',
    })
    expect((sheet.element as HTMLElement).style.width).toBe('900px')
    expect(Number(canvas.attributes('data-camera-scale'))).toBeCloseTo(0.5)
    expect(canvas.attributes('data-camera-mode')).toBe('fit')

    await wrapper.get('button[aria-label="Actual size"]').trigger('click')
    expect(Number(canvas.attributes('data-camera-scale'))).toBe(1)
    expect(canvas.attributes('data-camera-mode')).toBe('manual')
    await wrapper.get('button[aria-label="Zoom out"]').trigger('click')
    expect(Number(canvas.attributes('data-camera-scale'))).toBe(0.8)

    await wrapper.get('button[aria-label="Mobile"]').trigger('click')
    await wrapper.get('button[aria-label="Fit canvas"]').trigger('click')
    expect(sheet.attributes('data-intrinsic-width')).toBe('390')
    expect((sheet.element as HTMLElement).style.width).toBe('390px')
    expect(Number(canvas.attributes('data-camera-scale'))).toBe(1)
    expect(wrapper.emitted('update:document')).toBeUndefined()
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

    const rootList = wrapper.get('.mx-config-form-designer__runtime-surface [data-config-form-responsive-layout]')
    const rootNodes = rootList.findAll(':scope > [data-config-node-id]')
    expect(rootList.classes()).toEqual(expect.arrayContaining(['mx-config-form__row', 'mx-config-form__row--grid']))
    expect(rootNodes.map(node => node.attributes('style'))).toEqual([
      expect.stringContaining('--mx-config-form-span-desktop: 24'),
      expect.stringContaining('--mx-config-form-span-desktop: 8'),
      expect.stringContaining('--mx-config-form-span-desktop: 8'),
      expect.stringContaining('--mx-config-form-span-desktop: 8'),
    ])
    expect(rootNodes.map(node => node.attributes('data-designer-span'))).toEqual(['24', '8', '8', '8'])
    expect(rootNodes.every(node => node.classes().includes('mx-config-form__cell'))).toBe(true)

    await rootNodes[0]!.trigger('pointerdown')
    expect(wrapper.findAll('.mx-config-form-designer__selection-box')).toHaveLength(1)
    expect(wrapper.find('.mx-config-form-designer__selection-box .mx-config-form-designer__node-actions').exists()).toBe(true)
  })

  it('projects nested containers through the real runtime tree without designer placeholder chrome', () => {
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
    expect(emptySection.find('.mx-config-form-designer__empty-slot').exists()).toBe(false)
    expect(emptySection.find('[data-designer-drop-tail]').exists()).toBe(false)

    const filledSection = wrapper.get('[data-node-id="filled-section"]')
    expect(filledSection.get('[data-node-id="nested-input"]').attributes()).toMatchObject({
      'data-material': 'element.input',
      'data-node-kind': 'field',
      'data-config-path': 'fields.1.slots.default.0',
      'data-config-slot': 'default',
    })
  })

  it('generates registered event and binding controls that emit model operations', async () => {
    const document = twoFieldDocument()
    const modelRegistry = createLowCodeComponentRegistry(registry)
    const model = designerDocumentToConfigModel(document, { id: 'page', name: 'Page' })
    const wrapper = mount(ConfigFormDesigner, {
      props: { document, model, modelRegistry, registry },
    })

    await wrapper.get('[data-focus-node-id="first"]').trigger('pointerdown')
    await wrapper.get('[data-property-tab="events"]').trigger('click')
    const eventInput = wrapper.get('[role="tabpanel"]:not([hidden]) input[aria-label="Value change"]')
    await eventInput.setValue('audit, notify')
    await eventInput.trigger('blur')
    await flushPromises()

    expect(wrapper.emitted('modelOperation')?.at(-1)).toEqual([{
      type: 'updateEvents',
      nodeId: 'first',
      events: { input: [{ action: 'audit' }, { action: 'notify' }] },
    }])

    await wrapper.get('[data-property-tab="bindings"]').trigger('click')
    const bindingInput = wrapper.get('[role="tabpanel"]:not([hidden]) input[aria-label="Value"]')
    await bindingInput.setValue('profile.first')
    await bindingInput.trigger('blur')

    expect(wrapper.emitted('modelOperation')?.at(-1)).toEqual([{
      type: 'updateBindings',
      nodeId: 'first',
      bindings: { value: { source: 'profile.first' } },
    }])
  })

  it('uses container width for narrow workspace views and disconnects its observer', async () => {
    let resizeCallback: ResizeObserverCallback | undefined
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe = observe
      unobserve = vi.fn()
      disconnect = disconnect
    })

    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    const root = wrapper.get('.mx-config-form-designer')
    vi.spyOn(root.element, 'getBoundingClientRect').mockReturnValue({ width: 680 } as DOMRect)
    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()

    expect(root.attributes('data-workspace-mode')).toBe('narrow')
    expect(observe).toHaveBeenCalledWith(root.element)
    expect(wrapper.find('button[aria-label="Hide materials"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Hide properties"]').exists()).toBe(false)
    expect(wrapper.get('.mx-config-form-designer__workspace-tabs').attributes('role')).toBe('tablist')
    expect(wrapper.get('.mx-config-form-designer__workspace-panel.is-canvas').attributes('hidden')).toBeUndefined()
    expect(wrapper.get('.mx-config-form-designer__workspace-panel.is-palette').attributes('hidden')).toBe('')

    await wrapper.get('[data-workspace-tab="palette"]').trigger('click')
    expect(root.attributes('data-active-view')).toBe('palette')
    expect(wrapper.get('.mx-config-form-designer__workspace-panel.is-palette').attributes('hidden')).toBeUndefined()
    expect(wrapper.get('.mx-config-form-designer__workspace-panel.is-canvas').attributes('hidden')).toBe('')

    await wrapper.get('[data-workspace-tab="palette"]').trigger('keydown', { key: 'ArrowRight' })
    expect(root.attributes('data-active-view')).toBe('canvas')
    wrapper.unmount()
    expect(disconnect).toHaveBeenCalledTimes(2)
  })

  it('collapses and restores desktop sidebars without leaving hidden controls reachable', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    const root = wrapper.get('.mx-config-form-designer')
    const palettePanel = wrapper.get('.mx-config-form-designer__workspace-panel.is-palette')
    const propertiesPanel = wrapper.get('.mx-config-form-designer__workspace-panel.is-properties')

    expect(root.attributes()).toMatchObject({
      'data-palette-open': 'true',
      'data-properties-open': 'true',
    })
    await wrapper.get('button[aria-label="Hide materials"]').trigger('click')
    expect(root.attributes('data-palette-open')).toBe('false')
    expect(palettePanel.attributes('hidden')).toBe('')
    expect(palettePanel.attributes('inert')).toBe('')
    expect(wrapper.get('button[aria-label="Show materials"]').attributes('aria-expanded')).toBe('false')

    await wrapper.get('button[aria-label="Hide properties"]').trigger('click')
    expect(root.attributes('data-properties-open')).toBe('false')
    expect(propertiesPanel.attributes('hidden')).toBe('')
    expect(propertiesPanel.attributes('inert')).toBe('')

    await wrapper.get('button[aria-label="Show materials"]').trigger('click')
    await wrapper.get('button[aria-label="Show properties"]').trigger('click')
    expect(root.attributes()).toMatchObject({
      'data-palette-open': 'true',
      'data-properties-open': 'true',
    })
    expect(palettePanel.attributes('hidden')).toBeUndefined()
    expect(propertiesPanel.attributes('hidden')).toBeUndefined()
  })

  it('uses mutually exclusive non-modal drawers in the medium workspace', async () => {
    let resizeCallback: ResizeObserverCallback | undefined
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    })

    const formDocument = twoFieldDocument()
    ;(formDocument.nodes[0] as DesignerFieldNode).label = 'First field'
    ;(formDocument.nodes[1] as DesignerFieldNode).label = 'Second field'
    const wrapper = mount(ConfigFormDesigner, {
      attachTo: window.document.body,
      props: { document: formDocument, registry },
    })
    const root = wrapper.get('.mx-config-form-designer')
    vi.spyOn(root.element, 'getBoundingClientRect').mockReturnValue({ width: 900 } as DOMRect)
    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()

    const canvasPanel = wrapper.get('.mx-config-form-designer__workspace-panel.is-canvas')
    const palettePanel = wrapper.get('.mx-config-form-designer__workspace-panel.is-palette')
    const propertiesPanel = wrapper.get('.mx-config-form-designer__workspace-panel.is-properties')
    expect(root.attributes()).toMatchObject({
      'data-workspace-mode': 'medium',
      'data-palette-open': 'false',
      'data-properties-open': 'false',
    })
    expect(canvasPanel.attributes('hidden')).toBeUndefined()
    expect(palettePanel.attributes()).toMatchObject({ hidden: '', inert: '' })
    expect(propertiesPanel.attributes()).toMatchObject({ hidden: '', inert: '' })

    const propertiesTrigger = wrapper.get('button[aria-label="Show properties"]')
    ;(propertiesTrigger.element as HTMLButtonElement).focus()
    await propertiesTrigger.trigger('click')
    expect(propertiesTrigger.attributes('aria-expanded')).toBe('true')
    expect(propertiesPanel.attributes('hidden')).toBeUndefined()
    expect(propertiesPanel.attributes('role')).toBe('region')
    expect(palettePanel.attributes('hidden')).toBe('')

    const paletteTrigger = wrapper.get('button[aria-label="Show materials"]')
    await paletteTrigger.trigger('click')
    expect(palettePanel.attributes('hidden')).toBeUndefined()
    expect(propertiesPanel.attributes('hidden')).toBe('')

    await wrapper.get('button[aria-label="Show properties"]').trigger('click')
    const firstNode = wrapper.get('[data-focus-node-id="first"]')
    await firstNode.trigger('pointerdown')
    expect(propertiesPanel.attributes('hidden')).toBeUndefined()
    expect(propertiesPanel.get('.mx-config-form-designer__property-heading strong').text()).toBe('First field')
    expect(propertiesPanel.get('.mx-config-form-designer__property-heading').text()).not.toContain('element.input')
    expect(propertiesPanel.findAll('[role="tab"]').every((tab) => {
      const element = tab.element as HTMLElement
      return element.scrollWidth <= element.clientWidth
    })).toBe(true)

    const canvas = wrapper.get('.mx-config-form-designer__canvas-sheet')
    const selection = wrapper.get('.mx-config-form-designer__selection-box')
    expect(selection.attributes('style')).toContain('width:')
    expect(selection.attributes('style')).toContain('height:')
    await canvas.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(propertiesPanel.attributes('hidden')).toBe('')
    expect(document.activeElement).toBe(wrapper.get('[data-editor-focus-node-id="first"]').element)

    const reopenedTrigger = wrapper.get('button[aria-label="Show properties"]')
    await reopenedTrigger.trigger('click')
    const closeButton = propertiesPanel.get('.mx-config-form-designer__drawer-header button')
    ;(closeButton.element as HTMLButtonElement).focus()
    await closeButton.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(propertiesPanel.attributes('hidden')).toBe('')
    expect(document.activeElement).toBe(reopenedTrigger.element)

    await reopenedTrigger.trigger('click')
    await propertiesPanel.get('.mx-config-form-designer__drawer-header button').trigger('click')
    await nextTick()
    expect(propertiesPanel.attributes('hidden')).toBe('')
    expect(document.activeElement).toBe(reopenedTrigger.element)
    wrapper.unmount()
  })

  it('preserves the active view and visible focus across workspace mode changes', async () => {
    let resizeCallback: ResizeObserverCallback | undefined
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    })

    const wrapper = mount(ConfigFormDesigner, {
      attachTo: window.document.body,
      props: { document: twoFieldDocument(), registry },
    })
    const root = wrapper.get('.mx-config-form-designer')
    const rect = vi.spyOn(root.element, 'getBoundingClientRect')
    rect.mockReturnValue({ width: 900 } as DOMRect)
    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()

    await wrapper.get('[data-sidebar-trigger="properties"]').trigger('click')
    const propertyInput = wrapper.get('.mx-config-form-designer__properties input')
    ;(propertyInput.element as HTMLInputElement).focus()
    rect.mockReturnValue({ width: 680 } as DOMRect)
    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()

    expect(root.attributes()).toMatchObject({
      'data-active-view': 'properties',
      'data-workspace-mode': 'narrow',
    })
    expect(wrapper.get('[data-workspace-panel="properties"]').attributes('hidden')).toBeUndefined()
    expect(document.activeElement).toBe(propertyInput.element)

    const propertiesTab = wrapper.get('[data-workspace-tab="properties"]')
    ;(propertiesTab.element as HTMLButtonElement).focus()
    rect.mockReturnValue({ width: 1200 } as DOMRect)
    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(root.attributes('data-workspace-mode')).toBe('desktop')
    expect(wrapper.get('[data-workspace-panel="properties"]').attributes('hidden')).toBeUndefined()
    expect(document.activeElement).toBe(wrapper.get('[data-sidebar-trigger="properties"]').element)

    rect.mockReturnValue({ width: 900 } as DOMRect)
    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()
    const closeButton = wrapper.get('[data-workspace-panel="properties"] [data-drawer-control="properties"]')
    ;(closeButton.element as HTMLButtonElement).focus()
    rect.mockReturnValue({ width: 680 } as DOMRect)
    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(document.activeElement).toBe(wrapper.get('[data-workspace-tab="properties"]').element)

    rect.mockReturnValue({ width: 900 } as DOMRect)
    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    const reopenedCloseButton = wrapper.get('[data-workspace-panel="properties"] [data-drawer-control="properties"]')
    ;(reopenedCloseButton.element as HTMLButtonElement).focus()
    rect.mockReturnValue({ width: 1200 } as DOMRect)
    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(document.activeElement).toBe(wrapper.get('[data-sidebar-trigger="properties"]').element)
    wrapper.unmount()
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

    expect(wrapper.find('[data-node-id="dependent"]').exists()).toBe(false)
    expect(wrapper.get('[data-node-id="controller"] input').attributes('value')).toBe('hide')
    await wrapper.get('button[aria-label="Linkage preview"]').trigger('click')
    expect(wrapper.find('[data-node-id="dependent"]').exists()).toBe(false)

    const controller = wrapper.get('[data-node-id="controller"] input')
    await controller.setValue('show')
    expect(wrapper.find('[data-node-id="dependent"]').exists()).toBe(true)
    expect(wrapper.emitted('update:document')).toBeUndefined()
    expect(exposed.exportDocument()).toBe(exportedBeforePreview)

    await wrapper.get('button[aria-label="Linkage preview"]').trigger('click')
    expect(wrapper.find('[data-node-id="dependent"]').exists()).toBe(false)
    expect((wrapper.get('[data-node-id="controller"] input').element as HTMLInputElement).value).toBe('hide')

    expect(exposed.dispatch({
      type: 'updateNodePath',
      nodeId: 'controller',
      path: ['defaultValue'],
      value: 'show',
    })).toBe(true)
    await flushPromises()
    expect((wrapper.get('[data-node-id="controller"] input').element as HTMLInputElement).value).toBe('show')
    expect(wrapper.find('[data-node-id="dependent"]').exists()).toBe(true)
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

    await wrapper.get('[data-focus-node-id="enabled"]').trigger('pointerdown')
    await wrapper.get('[data-property-tab="conditions"]').trigger('click')
    const disabledSetter = wrapper.findAll('.mx-config-form-designer__setter')
      .find(setter => setter.text().includes('Disabled'))!
    await disabledSetter.findAll('button').find(button => button.text() === 'Always')!.trigger('click')

    expect(wrapper.get('button[aria-label="Linkage preview"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-node-id="enabled"] input').attributes('disabled')).toBeDefined()
    expect(lastDocument(wrapper).nodes[0]).toMatchObject({
      conditions: { disabled: { kind: 'literal', value: true } },
    })
  })

  it('adds a reaction visually and previews it without writing derived state to the document', async () => {
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

    await wrapper.get('[data-focus-node-id="enabled"]').trigger('pointerdown')
    await wrapper.get('[data-property-tab="reactions"]').trigger('click')
    await wrapper.get('.mx-config-form-designer__reaction-editor > .mx-config-form-designer__add-row').trigger('click')
    await flushPromises()

    expect(wrapper.get('button[aria-label="Linkage preview"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-node-id="enabled"] input').attributes('disabled')).toBeDefined()
    expect(lastDocument(wrapper).nodes[0]).toEqual({
      ...document.nodes[0],
      reactions: [{
        id: 'reaction-1',
        when: { kind: 'literal', value: true },
        then: [{ kind: 'setState', target: 'enabled', state: { disabled: true } }],
      }],
    })
    expect(lastDocument(wrapper).nodes[0]).not.toHaveProperty('disabled')
  })

  it('keeps reaction ids unique across nodes and rejects duplicate visual renames', async () => {
    const document: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [
        {
          id: 'source',
          kind: 'field',
          material: 'element.input',
          field: 'source',
          reactions: [{
            id: 'reaction-1',
            when: { kind: 'literal', value: true },
            then: [{ kind: 'validate', target: 'source' }],
          }],
        },
        {
          id: 'target',
          kind: 'field',
          material: 'element.input',
          field: 'target',
        },
      ],
    }
    const wrapper = mount(ConfigFormDesigner, { props: { document, registry } })

    await wrapper.get('[data-focus-node-id="target"]').trigger('pointerdown')
    await wrapper.get('[data-property-tab="reactions"]').trigger('click')
    await wrapper.get('.mx-config-form-designer__reaction-editor > .mx-config-form-designer__add-row').trigger('click')
    await flushPromises()

    expect(lastDocument(wrapper).nodes[1]?.reactions?.[0]?.id).toBe('reaction-2')
    const reactionId = wrapper.get('input[aria-label="Reaction id"]')
    await reactionId.setValue('reaction-1')
    await reactionId.trigger('change')
    await flushPromises()
    expect(lastDocument(wrapper).nodes[1]?.reactions?.[0]?.id).toBe('reaction-2')
  })

  it('adds materials, commits text on blur, and preserves undo/redo boundaries', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      attachTo: document.body,
      props: { document: emptyDocument(), registry },
    })
    await flushPromises()

    const inputMaterial = wrapper.get('[data-material-key="element.input"]')
    expect(inputMaterial.attributes()).toMatchObject({
      'aria-label': 'Input',
      'type': 'button',
    })
    expect(inputMaterial.element.tagName).toBe('BUTTON')
    expect(inputMaterial.find('input, textarea, select, [role="radio"], [role="checkbox"]').exists()).toBe(false)
    const inputMaterialRow = wrapper.get('[data-material-row-key="element.input"]')
    expect(inputMaterialRow.get('.mx-config-form-designer__palette-item-preview').attributes()).toMatchObject({
      'aria-hidden': 'true',
      'inert': '',
    })
    expect(inputMaterialRow.find('[data-specimen-node-id]').exists()).toBe(true)

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
    expect(wrapper.emitted('update:document')).toHaveLength(updateCount! + 1)
    expect(lastDocument(wrapper).nodes[0]).toMatchObject({ label: 'Display name' })
    await labelInput!.trigger('blur')
    expect(wrapper.emitted('update:document')).toHaveLength(updateCount! + 1)

    await wrapper.get('button[aria-label="Undo"]').trigger('click')
    expect(lastDocument(wrapper).nodes[0]).not.toHaveProperty('label')
    await wrapper.get('button[aria-label="Redo"]').trigger('click')
    expect(lastDocument(wrapper).nodes[0]).toMatchObject({ label: 'Display name' })

    wrapper.unmount()
  })

  it('keeps palette keyboard dragging as a candidate until Space commits or Escape cancels', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      attachTo: document.body,
      props: { document: emptyDocument(), registry },
    })
    await flushPromises()

    const updateCount = wrapper.emitted('update:document')?.length ?? 0
    await wrapper.get('[data-material-key="element.input"]').trigger('keydown', { key: ' ' })
    await flushPromises()

    expect(wrapper.get('[data-material-key="element.input"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-config-node-state~="candidate"]').attributes('data-material')).toBe('element.input')
    expect(wrapper.emitted('update:document')?.length ?? 0).toBe(updateCount)
    expect(wrapper.get('.mx-config-form-designer__screen-reader').text()).toContain('Picked up Input')

    await wrapper.get('[data-material-key="element.input"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.get('.mx-config-form-designer__screen-reader').text()).toContain('will be placed')
    await wrapper.get('[data-material-key="element.input"]').trigger('keydown', { key: ' ' })
    await flushPromises()

    expect(lastDocument(wrapper).nodes).toHaveLength(1)
    expect(wrapper.get('[data-material-key="element.input"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-config-node-state~="candidate"]').exists()).toBe(false)
    expect(wrapper.get('.mx-config-form-designer__screen-reader').text()).toContain('Dropped Input')

    const committedUpdateCount = wrapper.emitted('update:document')?.length ?? 0
    await wrapper.get('[data-material-key="element.input"]').trigger('keydown', { key: ' ' })
    await wrapper.get('[data-material-key="element.input"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(wrapper.emitted('update:document')?.length ?? 0).toBe(committedUpdateCount)
    expect(wrapper.find('[data-config-node-state~="candidate"]').exists()).toBe(false)
    expect(wrapper.get('.mx-config-form-designer__screen-reader').text()).toContain('Cancelled dragging Input')
    wrapper.unmount()
  })

  it('starts and completes node keyboard dragging from the overlay move handle', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      attachTo: document.body,
      props: { document: twoFieldDocument(), registry },
    })
    await flushPromises()

    await wrapper.get('[data-focus-node-id="first"]').trigger('pointerdown')
    await flushPromises()
    await wrapper.get('button[aria-label="Move node"]').trigger('keydown', { key: ' ' })
    await flushPromises()

    expect(wrapper.get('button[aria-label="Move node"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-config-node-id="first"]').attributes('data-config-node-state')).toContain('candidate')
    expect(wrapper.emitted('update:document')).toBeUndefined()

    await wrapper.get('button[aria-label="Move node"]').trigger('keydown', { key: ' ' })
    await flushPromises()
    expect(lastDocument(wrapper).nodes.map(node => node.id)).toEqual(['second', 'first'])
    expect(wrapper.get('.mx-config-form-designer__screen-reader').text()).toContain('Dropped first')
    wrapper.unmount()
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

    expect(wrapper.get('[data-focus-node-id="external"]').attributes()).toMatchObject({
      role: 'presentation',
    })
    expect(wrapper.get('[data-focus-node-id="external"]').attributes('tabindex')).toBeUndefined()
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

  it('renders the design canvas through RuntimeSurface without Sortable business DOM', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    await flushPromises()
    expect(wrapper.find('.mx-config-form-designer__node-list').exists()).toBe(false)
    expect(wrapper.find('.mx-config-form-designer__runtime-surface > form').exists()).toBe(true)
    expect(wrapper.findAll('.mx-config-form-designer__runtime-surface [data-config-node-id]')).toHaveLength(2)
  })

  it('keeps the runtime tree inert while the canvas owns design focus and selection', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      attachTo: document.body,
      props: { document: twoFieldDocument(), registry },
    })
    await flushPromises()

    const canvas = wrapper.get('.mx-config-form-designer__canvas-sheet')
    const runtimeForm = wrapper.get('.mx-config-form-designer__runtime-surface > form')
    const firstNode = wrapper.get('[data-config-node-id="first"]')
    const input = runtimeForm.get('input')

    expect(runtimeForm.attributes()).toMatchObject({ 'aria-hidden': 'true' })
    expect(runtimeForm.attributes()).toHaveProperty('inert')
    expect(input.element.closest('[inert]')?.tagName).toBe('FORM')
    expect(firstNode.attributes()).toMatchObject({ role: 'presentation' })
    expect(firstNode.attributes('tabindex')).toBeUndefined()
    expect(canvas.attributes('tabindex')).toBeUndefined()

    const selectionEvent = new Event('selectstart', { bubbles: true, cancelable: true })
    canvas.element.dispatchEvent(selectionEvent)
    expect(selectionEvent.defaultPrevented).toBe(true)

    await firstNode.trigger('pointerdown')
    await flushPromises()

    expect(document.activeElement).toBe(wrapper.get('[data-editor-focus-node-id="first"]').element)
    expect(wrapper.findAll('.mx-config-form-designer__selection-box')).toHaveLength(1)
    expect(input.element).not.toBe(document.activeElement)

    const toolbar = wrapper.get('[role="toolbar"][aria-label="Node actions"]')
    expect(toolbar.findAll('[data-node-toolbar-button]')).toHaveLength(4)
    const moreActions = toolbar.get('button[aria-label="More actions"]')
    expect(moreActions.attributes('aria-expanded')).toBe('false')

    await moreActions.trigger('click')
    await nextTick()
    const menu = wrapper.get('[role="menu"]')
    const menuItems = menu.findAll('[role="menuitem"]')
    expect(menuItems).toHaveLength(4)
    expect(document.activeElement).toBe(menuItems[0]!.element)

    await menu.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(menuItems.at(-1)!.element)
    await menu.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(moreActions.element)

    await moreActions.trigger('click')
    await wrapper.get('[role="menuitem"][aria-label="Move node down"]').trigger('click')
    await flushPromises()
    expect(lastDocument(wrapper).nodes.map(node => node.id)).toEqual(['second', 'first'])
    wrapper.unmount()
  })

  it('selects the deepest nested runtime node from canvas geometry without control events', async () => {
    const rect = (x: number, y: number, width: number, height: number): DOMRect => ({
      bottom: y + height,
      height,
      left: x,
      right: x + width,
      top: y,
      width,
      x,
      y,
      toJSON: () => ({}),
    })
    const getRect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('mx-config-form-designer__canvas-sheet'))
        return rect(0, 0, 640, 480)
      if (this.dataset.configNodeId === 'outer')
        return rect(80, 80, 480, 240)
      if (this.dataset.configNodeId === 'inner')
        return rect(120, 120, 260, 40)
      return rect(0, 0, 0, 0)
    })

    try {
      const wrapper = mount(ConfigFormDesigner, {
        attachTo: document.body,
        props: {
          document: {
            version: 1,
            form: {},
            nodes: [{
              id: 'outer',
              kind: 'container',
              material: 'element.section',
              slots: {
                default: [{ id: 'inner', kind: 'field', material: 'element.input', field: 'inner' }],
              },
            }],
          },
          registry,
        },
      })
      await flushPromises()

      const pointerdown = new Event('pointerdown', { bubbles: true, cancelable: true })
      Object.defineProperties(pointerdown, {
        clientX: { value: 160 },
        clientY: { value: 140 },
        pointerId: { value: 17 },
      })
      wrapper.get('.mx-config-form-designer__canvas-sheet').element.dispatchEvent(pointerdown)
      await flushPromises()

      expect(wrapper.get('[data-config-node-id="inner"]').attributes('data-config-node-state')).toContain('selected')
      expect(wrapper.get('[data-config-node-id="outer"]').attributes('data-config-node-state') ?? '').not.toContain('selected')
      wrapper.unmount()
    }
    finally {
      getRect.mockRestore()
    }
  })

  it('keeps the runtime canvas mounted across sequential model operations', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: emptyDocument(), registry },
    })
    const canvas = wrapper.get('.mx-config-form-designer__canvas').element

    await wrapper.get('[data-material-key="element.input"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('.mx-config-form-designer__canvas').element).toBe(canvas)

    await wrapper.get('[data-material-key="element.section"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('.mx-config-form-designer__canvas').element).toBe(canvas)
    expect(lastDocument(wrapper).nodes).toHaveLength(2)
  })

  it('renders nested runtime slots without trailing placeholder nodes', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: {
        document: {
          version: 1,
          form: {},
          nodes: [
            {
              id: 'section',
              kind: 'container',
              material: 'element.section',
              slots: {
                default: [{ id: 'nested', kind: 'field', material: 'element.input', field: 'nested' }],
              },
            },
            { id: 'root', kind: 'field', material: 'element.input', field: 'root' },
          ],
        },
        registry,
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-designer-drop-tail]').exists()).toBe(false)
    const section = wrapper.get('[data-config-node-id="section"]')
    const nested = section.get('[data-config-node-id="nested"]')
    expect(nested.attributes()).toMatchObject({
      'data-config-path': 'fields.0.slots.default.0',
      'data-config-slot': 'default',
    })
    expect(wrapper.get('[data-config-node-id="root"]').attributes('data-config-path')).toBe('fields.1')
  })

  it('keeps deeply nested RuntimeSurface metadata aligned with the model path', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: {
        document: {
          version: 1,
          form: {},
          nodes: [{
            id: 'outer',
            kind: 'container',
            material: 'element.section',
            slots: {
              default: [{
                id: 'middle',
                kind: 'container',
                material: 'element.section',
                slots: {
                  default: [{ id: 'inner', kind: 'field', material: 'element.input', field: 'inner' }],
                },
              }],
            },
          }],
        },
        registry,
      },
    })
    await flushPromises()

    expect(wrapper.get('[data-config-node-id="outer"]').attributes('data-config-path')).toBe('fields.0')
    expect(wrapper.get('[data-config-node-id="middle"]').attributes()).toMatchObject({
      'data-config-path': 'fields.0.slots.default.0',
      'data-config-slot': 'default',
    })
    expect(wrapper.get('[data-config-node-id="inner"]').attributes()).toMatchObject({
      'data-config-path': 'fields.0.slots.default.0.slots.default.0',
      'data-config-slot': 'default',
    })
  })

  it('disables palette drag sources when the designer becomes readonly', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    await flushPromises()
    await wrapper.setProps({ readonly: true })
    await flushPromises()
    expect(wrapper.get('[data-material-key="element.input"]').attributes('disabled')).toBeDefined()
  })

  it('prevents native mouse dragging from cancelling repeated material drags', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    const source = wrapper.get('[data-material-key="element.input"]').element
    const pointerdown = new Event('pointerdown', { bubbles: true, cancelable: true })
    Object.defineProperties(pointerdown, {
      button: { value: 0 },
      clientX: { value: 20 },
      clientY: { value: 20 },
      pointerId: { value: 7 },
      pointerType: { value: 'mouse' },
    })

    source.dispatchEvent(pointerdown)
    expect(pointerdown.defaultPrevented).toBe(true)
    wrapper.unmount()
  })

  it('keeps runtime DOM aligned with the model when no drag operation commits', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    await flushPromises()
    expect(wrapper.findAll('.mx-config-form-designer__runtime-surface [data-config-node-id]').map(node => node.attributes('data-config-node-id'))).toEqual(['first', 'second'])
    expect(wrapper.emitted('update:document')).toBeUndefined()
  })

  it('renders a registry-backed candidate and overlay for a collapsed nested target until cancel', async () => {
    const previewRuntime = vi.fn((_command, projected: DesignerDocument) => createDesignerRuntimeProjection(projected, registry))
    const rect = (x: number, y: number, width: number, height: number): DOMRect => ({
      bottom: y + height,
      height,
      left: x,
      right: x + width,
      top: y,
      width,
      x,
      y,
      toJSON: () => ({}),
    })
    const getRect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('mx-config-form-designer__canvas-sheet'))
        return rect(0, 0, 600, 600)
      if (this.dataset.configNodeId === 'section' || this.dataset.configNodeState?.includes('candidate'))
        return rect(100, 120, 300, 0)
      return rect(0, 0, 100, 32)
    })
    const elementsFromPoint = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint')
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: vi.fn(() => []),
    })

    try {
      const wrapper = mount(ConfigFormDesigner, {
        attachTo: document.body,
        props: {
          document: {
            version: 1,
            form: {},
            nodes: [{
              id: 'section',
              kind: 'container',
              material: 'element.section',
              slots: { default: [] },
            }],
          },
          commandControl: { apply: vi.fn(() => true), previewRuntime },
          registry,
        },
      })
      await flushPromises()

      const pointerdown = new Event('pointerdown', { bubbles: true, cancelable: true })
      Object.defineProperties(pointerdown, {
        button: { value: 0 },
        clientX: { value: 20 },
        clientY: { value: 20 },
        pointerId: { value: 9 },
        pointerType: { value: 'mouse' },
      })
      wrapper.get('[data-material-key="element.input"]').element.dispatchEvent(pointerdown)
      const pointermove = new Event('pointermove', { bubbles: true, cancelable: true })
      Object.defineProperties(pointermove, {
        clientX: { value: 220 },
        clientY: { value: 120 },
        pointerId: { value: 9 },
      })
      window.dispatchEvent(pointermove)
      await flushPromises()

      expect(previewRuntime).toHaveBeenCalledOnce()
      for (let index = 0; index < 4; index += 1) {
        window.dispatchEvent(pointermove)
        await flushPromises()
      }
      expect(previewRuntime).toHaveBeenCalledOnce()

      const candidate = wrapper.get('[data-config-node-state~="candidate"]')
      expect(candidate.element.parentElement?.closest('[data-config-node-id]')?.getAttribute('data-config-node-id')).toBe('section')
      const indicatorHeight = Number.parseFloat(
        (wrapper.get('.mx-config-form-designer__collapsed-drop-indicator').element as HTMLElement).style.height,
      )
      const cameraScale = Number(wrapper.get('.mx-config-form-designer__canvas').attributes('data-camera-scale'))
      expect(indicatorHeight * cameraScale).toBe(36)
      expect(wrapper.emitted('update:document')).toBeUndefined()

      const pointercancel = new Event('pointercancel')
      Object.defineProperty(pointercancel, 'pointerId', { value: 9 })
      window.dispatchEvent(pointercancel)
      await flushPromises()
      expect(wrapper.find('[data-config-node-state~="candidate"]').exists()).toBe(false)
      expect(wrapper.find('.mx-config-form-designer__collapsed-drop-indicator').exists()).toBe(false)
      wrapper.unmount()
    }
    finally {
      getRect.mockRestore()
      if (elementsFromPoint)
        Object.defineProperty(document, 'elementsFromPoint', elementsFromPoint)
      else
        Reflect.deleteProperty(document, 'elementsFromPoint')
    }
  })

  it('sizes the pointer overlay from the runtime candidate and tears it down on cancel', async () => {
    const rect = (x: number, y: number, width: number, height: number): DOMRect => ({
      bottom: y + height,
      height,
      left: x,
      right: x + width,
      top: y,
      width,
      x,
      y,
      toJSON: () => ({}),
    })
    const getRect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('mx-config-form-designer__canvas-sheet'))
        return rect(0, 0, 600, 600)
      if (this.dataset.configNodeState?.includes('candidate'))
        return rect(40, 60, 320, 32)
      return rect(0, 0, 100, 32)
    })
    const elementsFromPoint = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint')
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: vi.fn(() => []),
    })

    try {
      const wrapper = mount(ConfigFormDesigner, {
        attachTo: document.body,
        props: { document: emptyDocument(), registry },
      })
      await flushPromises()
      const pointerdown = new Event('pointerdown', { bubbles: true, cancelable: true })
      Object.defineProperties(pointerdown, {
        button: { value: 0 },
        clientX: { value: 20 },
        clientY: { value: 20 },
        pointerId: { value: 10 },
        pointerType: { value: 'mouse' },
      })
      wrapper.get('[data-material-key="element.input"]').element.dispatchEvent(pointerdown)
      const pointermove = new Event('pointermove', { bubbles: true, cancelable: true })
      Object.defineProperties(pointermove, {
        clientX: { value: 220 },
        clientY: { value: 120 },
        pointerId: { value: 10 },
      })
      window.dispatchEvent(pointermove)
      await new Promise(resolve => window.setTimeout(resolve, 32))
      await nextTick()

      const overlay = wrapper.get<HTMLElement>('[data-designer-drag-overlay]')
      expect(overlay.attributes('style')).toContain('height: 32px')
      expect(overlay.attributes('style')).toContain('width: 320px')
      expect(overlay.attributes('style')).toContain('left: 204px')
      expect(overlay.attributes('style')).toContain('top: 104px')
      expect(overlay.element.children).toHaveLength(1)
      expect(overlay.element.querySelector('[data-config-node-id]')).toBeNull()
      expect(wrapper.find('.mx-config-form-designer__collapsed-drop-indicator').exists()).toBe(false)
      expect(wrapper.emitted('update:document')).toBeUndefined()

      const pointercancel = new Event('pointercancel')
      Object.defineProperty(pointercancel, 'pointerId', { value: 10 })
      window.dispatchEvent(pointercancel)
      await nextTick()
      expect(overlay.isVisible()).toBe(false)
      expect(overlay.element.children).toHaveLength(0)
      wrapper.unmount()
    }
    finally {
      getRect.mockRestore()
      if (elementsFromPoint)
        Object.defineProperty(document, 'elementsFromPoint', elementsFromPoint)
      else
        Reflect.deleteProperty(document, 'elementsFromPoint')
    }
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

  it('preserves modifier multi-selection when pointer focus precedes click', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    await flushPromises()

    const first = wrapper.get('[data-focus-node-id="first"]')
    const second = wrapper.get('[data-focus-node-id="second"]')
    await first.trigger('pointerdown')
    await second.trigger('pointerdown', { ctrlKey: true })

    expect(wrapper.get('[data-node-id="first"]').attributes('data-config-node-state')).toContain('selected')
    expect(wrapper.get('[data-node-id="second"]').attributes('data-config-node-state')).toContain('selected')
    expect(wrapper.emitted('selectionSetChange')?.at(-1)).toEqual([['first', 'second'], 'second'])
  })

  it('commits compatible multi-selection properties as one batch command', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      props: { document: twoFieldDocument(), registry },
    })
    const exposed = wrapper.vm as unknown as ConfigFormDesignerExpose
    exposed.select('first')
    exposed.select('second', 'toggle')
    await nextTick()

    expect(wrapper.get('.mx-config-form-designer__property-heading strong').text()).toBe('2 selected')
    const placeholder = wrapper.get('input[aria-label="Placeholder"]')
    await placeholder.setValue('Shared placeholder')
    await placeholder.trigger('blur')

    expect(wrapper.emitted('command')?.at(-1)?.[0]).toEqual({
      type: 'batch',
      commands: [
        { type: 'updateNodePath', nodeId: 'first', path: ['props', 'placeholder'], value: 'Shared placeholder' },
        { type: 'updateNodePath', nodeId: 'second', path: ['props', 'placeholder'], value: 'Shared placeholder' },
      ],
    })
  })

  it('copies and moves a multi-selection as atomic batch commands', async () => {
    const document = twoFieldDocument()
    document.nodes.push({ id: 'third', kind: 'field', material: 'element.input', field: 'third' })
    const wrapper = mount(ConfigFormDesigner, {
      props: { document, registry },
    })
    const exposed = wrapper.vm as unknown as ConfigFormDesignerExpose
    exposed.select('first')
    exposed.select('second', 'toggle')

    expect(exposed.performNodeAction('moveAfter', 'second')).toBe(true)
    expect(wrapper.emitted('command')?.at(-1)?.[0]).toMatchObject({
      type: 'batch',
      commands: [
        { type: 'moveNode', nodeId: 'second', target: { parentId: null, index: 2 } },
        { type: 'moveNode', nodeId: 'first', target: { parentId: null, index: 1 } },
      ],
    })
    expect(lastDocument(wrapper).nodes.map(node => node.id)).toEqual(['third', 'first', 'second'])

    expect(exposed.performNodeAction('copy', 'second')).toBe(true)
    const copyCommand = wrapper.emitted('command')?.at(-1)?.[0]
    expect(copyCommand).toMatchObject({
      type: 'batch',
      commands: [
        { type: 'copyNode', nodeId: 'second' },
        { type: 'copyNode', nodeId: 'first' },
      ],
    })
  })

  it('routes keyboard history through an external model history control', async () => {
    const undo = vi.fn(() => true)
    const redo = vi.fn(() => true)
    const wrapper = mount(ConfigFormDesigner, {
      props: {
        document: twoFieldDocument(),
        registry,
        historyControl: { canUndo: true, canRedo: true, undo, redo },
      },
    })

    await wrapper.get('.mx-config-form-designer').trigger('keydown', { key: 'z', ctrlKey: true })
    await wrapper.get('.mx-config-form-designer').trigger('keydown', { key: 'z', ctrlKey: true, shiftKey: true })
    expect(undo).toHaveBeenCalledOnce()
    expect(redo).toHaveBeenCalledOnce()
  })

  it('keeps the projected document unchanged when a controlled model command is rejected', () => {
    const apply = vi.fn(() => false)
    const wrapper = mount(ConfigFormDesigner, {
      props: {
        commandControl: { apply },
        document: twoFieldDocument(),
        registry,
      },
    })
    const exposed = wrapper.vm as unknown as ConfigFormDesignerExpose

    expect(exposed.dispatch({
      type: 'updateNode',
      nodeId: 'first',
      changes: { label: 'Rejected label' },
    })).toBe(false)
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'updateNode', nodeId: 'first' }),
      expect.objectContaining({ nodes: [expect.objectContaining({ label: 'Rejected label' }), expect.anything()] }),
    )
    expect(wrapper.emitted('update:document')).toBeUndefined()
    expect(wrapper.emitted('command')).toBeUndefined()
    expect(JSON.parse(exposed.exportDocument()).nodes[0]).not.toHaveProperty('label')
  })

  it('keeps DesignSurface controlled by the host model and external history', async () => {
    const document = emptyDocument()
    const modelRegistry = createLowCodeComponentRegistry(registry)
    const undo = vi.fn(() => true)
    const redo = vi.fn(() => true)
    let projectedDocument: DesignerDocument | undefined
    const apply = vi.fn((_command, projected: DesignerDocument) => {
      projectedDocument = projected
      return true
    })
    const wrapper = mount(DesignSurface, {
      props: {
        commandControl: { apply },
        document,
        historyControl: { canUndo: true, canRedo: true, undo, redo },
        model: designerDocumentToConfigModel(document, { id: 'page', name: 'Page' }),
        modelRegistry,
        registry,
      },
    })

    expect((wrapper.vm as any).$?.setupState.controller.history).toBeUndefined()

    expect(wrapper.find('.mx-config-form-designer__palette').exists()).toBe(true)
    expect(wrapper.find('.mx-config-form-designer__canvas').exists()).toBe(true)
    expect(wrapper.find('.mx-config-form-designer__properties').exists()).toBe(true)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Preview form"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Import document"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Export document"]').exists()).toBe(false)
    expect(wrapper.find('.mx-config-form-designer__canvas-tools').exists()).toBe(false)

    await wrapper.get('[data-material-key="element.input"]').trigger('click')
    expect(apply).toHaveBeenCalledOnce()
    expect(apply.mock.calls[0]?.[0]).toMatchObject({ type: 'addNode' })
    expect(projectedDocument?.nodes).toHaveLength(1)
    expect(wrapper.find('.mx-config-form-designer__canvas [data-node-id]').exists()).toBe(false)
    expect(wrapper.emitted('update:document')).toBeUndefined()
    expect(wrapper.emitted('command')).toBeUndefined()

    const nextDocument = projectedDocument!
    await wrapper.setProps({
      document: nextDocument,
      model: designerDocumentToConfigModel(nextDocument, { id: 'page', name: 'Page' }),
    })
    expect(wrapper.get('.mx-config-form-designer__canvas [data-node-id]').attributes('data-material')).toBe('element.input')

    const exposed = wrapper.vm as unknown as DesignSurfaceExpose
    expect(exposed.undo()).toBe(true)
    expect(exposed.redo()).toBe(true)
    expect(undo).toHaveBeenCalledOnce()
    expect(redo).toHaveBeenCalledOnce()
  })

  it('routes compatibility property operations through the host command bridge', () => {
    const applyModelOperation = vi.fn(() => true)
    const designDocument = twoFieldDocument()
    const wrapper = mount(DesignSurface, {
      props: {
        commandControl: { apply: vi.fn(() => true), applyModelOperation },
        document: designDocument,
        historyControl: { canUndo: false, canRedo: false, undo: vi.fn(() => false), redo: vi.fn(() => false) },
        model: designerDocumentToConfigModel(designDocument, { id: 'page', name: 'Page' }),
        modelRegistry: createLowCodeComponentRegistry(registry),
        registry,
      },
    })

    const propertyPanel = wrapper.findComponent({ name: 'DesignerPropertyPanel' })
    expect(propertyPanel.exists()).toBe(true)
    propertyPanel.vm.$emit('modelOperation', {
      type: 'updateProps',
      nodeId: 'first',
      props: { placeholder: 'Name' },
    })

    expect(applyModelOperation).toHaveBeenCalledWith({
      type: 'updateProps',
      nodeId: 'first',
      props: { placeholder: 'Name' },
    })
    expect(wrapper.emitted('modelOperation')).toBeUndefined()
    wrapper.unmount()
  })

  it('routes Workbench component events to Flow instead of editing legacy action references', async () => {
    const designDocument = twoFieldDocument()
    const wrapper = mount(DesignSurface, {
      props: {
        commandControl: { apply: vi.fn(() => true), applyModelOperation: vi.fn(() => true) },
        document: designDocument,
        eventEditor: 'flow',
        historyControl: { canUndo: false, canRedo: false, undo: vi.fn(() => false), redo: vi.fn(() => false) },
        model: designerDocumentToConfigModel(designDocument, { id: 'page', name: 'Page' }),
        modelRegistry: createLowCodeComponentRegistry(registry),
        registry,
      },
    })

    ;(wrapper.vm as unknown as DesignSurfaceExpose).select('first')
    await nextTick()
    await wrapper.get('[data-property-tab="events"]').trigger('click')
    const configure = wrapper.get('button[aria-label="Configure Value change event flow"]')
    await configure.trigger('click')

    expect(wrapper.emitted('configureEvent')).toEqual([['first', 'input']])
    expect(wrapper.find('.mx-config-form-designer__property-fields:not([hidden]) .mx-config-form-designer-property-form').exists()).toBe(false)
  })

  it('keeps external workspace navigation authoritative when a medium drawer becomes narrow', async () => {
    let resizeCallback: ResizeObserverCallback | undefined
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    })

    const designDocument = twoFieldDocument()
    const wrapper = mount(DesignSurface, {
      attachTo: window.document.body,
      props: {
        commandControl: { apply: vi.fn(() => true) },
        document: designDocument,
        historyControl: { canUndo: false, canRedo: false, undo: vi.fn(() => false), redo: vi.fn(() => false) },
        model: designerDocumentToConfigModel(designDocument, { id: 'page', name: 'Page' }),
        modelRegistry: createLowCodeComponentRegistry(registry),
        registry,
        workspaceNavigation: 'external',
      },
    })
    const root = wrapper.get('.mx-config-form-designer')
    const rect = vi.spyOn(root.element, 'getBoundingClientRect')
    rect.mockReturnValue({ width: 900 } as DOMRect)
    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()

    await wrapper.get('[data-sidebar-trigger="properties"]').trigger('click')
    const drawerControl = wrapper.get('[data-drawer-control="properties"]')
    ;(drawerControl.element as HTMLButtonElement).focus()
    expect(wrapper.get('[data-workspace-panel="properties"]').attributes('hidden')).toBeUndefined()

    rect.mockReturnValue({ width: 680 } as DOMRect)
    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()

    expect(root.attributes()).toMatchObject({
      'data-active-view': 'canvas',
      'data-workspace-mode': 'narrow',
      'data-workspace-navigation': 'external',
    })
    expect(wrapper.find('.mx-config-form-designer__workspace-tabs').exists()).toBe(false)
    expect(wrapper.get('[data-workspace-panel="canvas"]').attributes('hidden')).toBeUndefined()
    expect(wrapper.get('[data-workspace-panel="properties"]').attributes('hidden')).toBe('')
    expect(document.activeElement).toBe(wrapper.get('[data-workspace-panel="canvas"]').element)
    wrapper.unmount()
  })

  it('keeps dialog focus contained and restores it after Escape', async () => {
    const wrapper = mount(ConfigFormDesigner, {
      attachTo: document.body,
      props: { document: twoFieldDocument(), registry },
    })
    const exportTrigger = wrapper.get('button[aria-label="Export document"]')
    ;(exportTrigger.element as HTMLButtonElement).focus()
    await exportTrigger.trigger('click')
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    const transferDialog = wrapper.get('[role="dialog"][aria-label="Export document"]')
    expect(document.activeElement).toBe(transferDialog.get('textarea').element)
    const transferButtons = transferDialog.findAll('button:not([disabled])')
    const lastTransferButton = transferButtons.at(-1)!
    ;(lastTransferButton.element as HTMLButtonElement).focus()
    await lastTransferButton.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(transferButtons[0]!.element)
    await transferDialog.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(exportTrigger.element)

    const previewTrigger = wrapper.get('button[aria-label="Preview form"]')
    ;(previewTrigger.element as HTMLButtonElement).focus()
    await previewTrigger.trigger('click')
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    const previewDialog = wrapper.get('[role="dialog"][aria-label="Form preview"]')
    expect(document.activeElement).toBe(previewDialog.get('button[aria-label="Close preview"]').element)
    await previewDialog.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(previewTrigger.element)
    wrapper.unmount()
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
