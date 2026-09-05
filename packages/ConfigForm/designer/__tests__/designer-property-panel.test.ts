import type { ComponentContract, PageGraph, PageNode } from '@moluoxixi/config-form-model'
import type { DesignerMaterialDefinition, DesignerPropertySetterDefinition } from '../src/registry'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { DesignerPropertyPanel } from '../src/components/DesignerPropertyPanel'

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

const placeholderSetter: DesignerPropertySetterDefinition = {
  key: 'placeholder',
  label: 'Placeholder',
  path: ['props', 'placeholder'],
  control: 'text',
}

const NumberControl = defineComponent({
  inheritAttrs: false,
  props: {
    disabled: Boolean,
    modelValue: Number,
  },
  emits: ['change'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      ...attrs,
      'data-adapter-number': '',
      'disabled': props.disabled,
      'type': 'number',
      'value': props.modelValue,
      'onChange': (event: Event) => emit('change', Number((event.currentTarget as HTMLInputElement).value)),
    })
  },
})

const DefaultValueControl = defineComponent({
  inheritAttrs: false,
  props: {
    disabled: Boolean,
    kind: String,
    modelValue: null,
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      ...attrs,
      'data-adapter-default': '',
      'disabled': props.disabled,
      'type': 'text',
      'value': props.modelValue ?? '',
      'onInput': (event: Event) => emit('update:modelValue', (event.currentTarget as HTMLInputElement).value),
    })
  },
})

function field(
  id: string,
  component: string,
  values: Partial<Extract<PageNode, { kind: 'field' }>> = {},
): Extract<PageNode, { kind: 'field' }> {
  return {
    id,
    component,
    kind: 'field',
    field: id,
    props: {},
    events: {},
    bindings: {},
    ...values,
  } as Extract<PageNode, { kind: 'field' }>
}

function layout(
  id: string,
  component: string,
  values: Partial<Extract<PageNode, { kind: 'layout' }>> = {},
): Extract<PageNode, { kind: 'layout' }> {
  return {
    id,
    component,
    kind: 'layout',
    props: {},
    events: {},
    bindings: {},
    slots: { default: [] },
    ...values,
  } as Extract<PageNode, { kind: 'layout' }>
}

function graph(nodes: PageNode[], spans: Record<string, number> = {}, form: PageGraph['form'] = {}): PageGraph {
  return {
    version: 2,
    props: {},
    form,
    root: nodes.map(node => ({
      nodeId: node.id,
      placement: (spans[node.id] === undefined ? {} : { span: spans[node.id]! }) as PageGraph['root'][number]['placement'],
    })),
    nodesById: Object.fromEntries(nodes.map(node => [node.id, node])),
  }
}

function contract(
  key: string,
  kind: PageNode['kind'],
  values: Partial<ComponentContract> = {},
): ComponentContract {
  return {
    key,
    version: '1',
    kind,
    props: [],
    events: [],
    bindings: [],
    slots: kind === 'layout' ? [{ name: 'default' }] : [],
    allowedParents: [],
    defaults: {},
    ...values,
  }
}

function fieldMaterial(
  key: string,
  setters: DesignerPropertySetterDefinition[] = [],
  events: Array<{ name: string, title: string }> = [],
): DesignerMaterialDefinition {
  return {
    key,
    version: 1,
    kind: 'field',
    title: key,
    category: 'Fields',
    runtime: { component: 'input' },
    events,
    setters,
    createNode: ({ id }) => ({ id, field: id, kind: 'field', component: key }),
  }
}

function layoutMaterial(key: string): DesignerMaterialDefinition {
  return {
    key,
    version: 1,
    kind: 'layout',
    title: key,
    category: 'Layout',
    runtime: { component: 'section' },
    setters: [],
    slots: [{ name: 'default', title: 'Content' }],
    createNode: ({ id }) => ({ id, kind: 'layout', component: key, slots: { default: [] } }),
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: originalScrollIntoView,
  })
})

describe('designer property panel adaptive Inspector', () => {
  it('renders default values through the adapter control when registered', async () => {
    const node = field('name', 'test.input', { defaultValue: 'before' })
    const setter: DesignerPropertySetterDefinition = {
      key: 'defaultValue',
      label: 'Default value',
      path: ['defaultValue'],
      control: 'defaultValue',
      valueKind: 'text',
    }
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        graph: graph([node]),
        node,
        material: fieldMaterial('test.input', [setter]),
        componentDefinition: contract('test.input', 'field'),
        diagnostics: [],
        propertyControls: {
          defaultValue: {
            component: DefaultValueControl,
            props: { 'data-control-source': 'adapter' },
          },
        },
      },
    })

    const control = wrapper.get('[data-adapter-default]')
    expect(control.attributes('data-control-source')).toBe('adapter')
    expect((control.element as HTMLInputElement).value).toBe('before')
    expect(control.element.closest('.mx-config-form-designer-property-form__field')?.classList).toContain('is-simple')
    expect(control.element.closest('.mx-config-form-designer-property-form__field')?.classList).toContain('is-control-default-value')
    expect(control.element.closest('.mx-config-form-designer-property-form__field')
      ?.querySelector('.mx-config-form-designer__setter')).toBeNull()
    expect(wrapper.get('label').attributes('for')).toBe(control.attributes('id'))
    await control.setValue('after')
    expect(wrapper.emitted('updatePath')?.at(-1)).toEqual(['name', ['defaultValue'], 'after'])
  })

  it('keeps the core default-value fallback when no adapter control is registered', () => {
    const node = field('name', 'test.input', { defaultValue: 'before' })
    const setter: DesignerPropertySetterDefinition = {
      key: 'defaultValue',
      label: 'Default value',
      path: ['defaultValue'],
      control: 'defaultValue',
      valueKind: 'text',
    }
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        graph: graph([node]),
        node,
        material: fieldMaterial('test.input', [setter]),
        componentDefinition: contract('test.input', 'field'),
        diagnostics: [],
      },
    })

    expect(wrapper.get('.mx-config-form-designer__default-value > input').attributes('aria-label')).toBe('Default value')
  })

  it('renders sections from capabilities and restores focus only when the active tab disappears', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    const input = field('name', 'test.input')
    const section = layout('section', 'test.section')
    const inputMaterial = fieldMaterial('test.input', [placeholderSetter], [{ name: 'change', title: 'Change' }])
    const sectionMaterial = layoutMaterial('test.section')
    const inputContract = contract('test.input', 'field', {
      events: [{ name: 'change' }],
      bindings: [{ name: 'value', valueProp: 'modelValue', trigger: 'update:modelValue' }],
    })
    const sectionContract = contract('test.section', 'layout')
    const materials = new Map([
      ['test.input', inputMaterial],
      ['test.section', sectionMaterial],
    ])
    const contracts = new Map([
      ['test.input', inputContract],
      ['test.section', sectionContract],
    ])
    const wrapper = mount(DesignerPropertyPanel, {
      attachTo: document.body,
      props: {
        graph: graph([input, section]),
        node: input,
        nodes: [input],
        material: inputMaterial,
        componentDefinition: inputContract,
        getMaterial: component => materials.get(component),
        getComponentDefinition: component => contracts.get(component),
        diagnostics: [],
      },
    })

    expect(wrapper.findAll('[role="tab"]').map(tab => tab.attributes('data-property-tab'))).toEqual([
      'properties',
      'validation',
      'events',
      'bindings',
      'conditions',
      'reactions',
    ])
    const propertiesTab = wrapper.get('[data-property-tab="properties"]')
    ;(propertiesTab.element as HTMLElement).focus()
    await propertiesTab.trigger('keydown', { key: 'End' })
    expect(wrapper.get('[data-property-tab="reactions"]').attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(wrapper.get('[data-property-tab="reactions"]').element)
    await wrapper.get('[data-property-tab="reactions"]').trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(propertiesTab.element)
    await propertiesTab.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.get('[data-property-tab="reactions"]').attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(wrapper.get('[data-property-tab="reactions"]').element)
    await wrapper.get('[data-property-tab="reactions"]').trigger('keydown', { key: 'ArrowRight' })
    expect(propertiesTab.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(propertiesTab.element)
    expect(scrollIntoView).toHaveBeenCalled()

    const events = wrapper.get('[data-property-tab="events"]')
    await events.trigger('click')
    ;(events.element as HTMLElement).focus()
    expect(document.activeElement).toBe(events.element)

    await wrapper.setProps({
      node: section,
      nodes: [section],
      material: sectionMaterial,
      componentDefinition: sectionContract,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[role="tab"]').map(tab => tab.attributes('data-property-tab'))).toEqual([
      'properties',
      'conditions',
      'reactions',
    ])
    const properties = wrapper.get('[data-property-tab="properties"]')
    expect(properties.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(properties.element)

    await wrapper.setProps({
      node: input,
      nodes: [input],
      material: inputMaterial,
      componentDefinition: inputContract,
    })
    await wrapper.get('[data-property-tab="events"]').trigger('click')
    const eventButton = wrapper.get('[role="tabpanel"]:not([hidden]) button')
    ;(eventButton.element as HTMLElement).focus()
    await wrapper.setProps({
      node: section,
      nodes: [section],
      material: sectionMaterial,
      componentDefinition: sectionContract,
    })
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(wrapper.get('[data-property-tab="properties"]').element)

    await wrapper.setProps({
      node: input,
      nodes: [input],
      material: inputMaterial,
      componentDefinition: inputContract,
    })
    await wrapper.get('[data-property-tab="events"]').trigger('click')
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    await wrapper.setProps({
      node: section,
      nodes: [section],
      material: sectionMaterial,
      componentDefinition: sectionContract,
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-property-tab="properties"]').attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(outside)
  })

  it('uses common setters for heterogeneous selection and shows non-common stored data in full', async () => {
    const first = field('first', 'test.first', {
      events: { blur: [{ action: 'audit', args: { source: 'keyboard', attempts: [1, 2] } }] },
    })
    const second = field('second', 'test.second')
    const firstMaterial = fieldMaterial('test.first', [
      placeholderSetter,
      { key: 'clearable', label: 'Clearable', path: ['props', 'clearable'], control: 'boolean' },
    ])
    const secondMaterial = fieldMaterial('test.second', [
      { ...placeholderSetter, label: 'Hint' },
      { key: 'clearable', label: 'Clear mode', path: ['props', 'clearable'], control: 'select', options: [] },
    ])
    const firstContract = contract('test.first', 'field', { events: [{ name: 'change' }, { name: 'blur' }] })
    const secondContract = contract('test.second', 'field', { events: [{ name: 'change' }] })
    const materials = new Map([
      ['test.first', firstMaterial],
      ['test.second', secondMaterial],
    ])
    const contracts = new Map([
      ['test.first', firstContract],
      ['test.second', secondContract],
    ])
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        graph: graph([first, second]),
        node: first,
        nodes: [first, second],
        material: firstMaterial,
        componentDefinition: firstContract,
        getMaterial: component => materials.get(component),
        getComponentDefinition: component => contracts.get(component),
        diagnostics: [],
      },
    })

    expect(wrapper.text()).toContain('Placeholder')
    expect(wrapper.text()).not.toContain('Clearable')
    await wrapper.get('[data-property-tab="events"]').trigger('click')
    const stale = wrapper.get('[data-stale-kind="selection-incompatible"]')
    expect(stale.text()).toContain('blur')
    expect(stale.get('pre').text()).toBe(JSON.stringify(first.events.blur, null, 2))
    expect(stale.get('pre').text()).toContain('"attempts": [')
  })

  it('keeps missing metadata visible but disables declared editors', async () => {
    const node = field('enabled', 'test.switch', {
      events: { change: [{ action: 'toggle' }] },
    })
    const definition = contract('test.switch', 'field', { events: [{ name: 'change' }] })
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        graph: graph([node]),
        node,
        nodes: [node],
        componentDefinition: definition,
        diagnostics: [],
      },
    })

    await wrapper.get('[data-property-tab="events"]').trigger('click')
    expect(wrapper.get('[role="tabpanel"]:not([hidden]) button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-property-tab="properties"]').attributes('aria-selected')).toBe('false')
  })

  it('preserves unknown stored configuration as a read-only structured projection', async () => {
    const node = field('legacy', 'test.removed', {
      events: { removed: [{ action: 'legacy', args: { nested: { keep: true } } }] },
      bindings: { removedValue: { source: 'legacy.path' } },
    })
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        graph: graph([node]),
        node,
        nodes: [node],
        diagnostics: [],
      },
    })

    expect(wrapper.findAll('[role="tab"]').map(tab => tab.attributes('data-property-tab'))).toContain('events')
    await wrapper.get('[data-property-tab="events"]').trigger('click')
    const eventWarning = wrapper.get('[data-stale-kind="event-unknown"]')
    expect(eventWarning.get('pre').text()).toBe(JSON.stringify(node.events.removed, null, 2))
    expect(eventWarning.find('button').exists()).toBe(false)

    await wrapper.get('[data-property-tab="bindings"]').trigger('click')
    expect(wrapper.get('[data-stale-kind="binding-unknown"] pre').text())
      .toBe(JSON.stringify(node.bindings.removedValue, null, 2))
  })

  it('emits an exact stored-config removal only when matching metadata makes cleanup available', async () => {
    const node = field('legacy', 'test.input', {
      events: {
        keep: [{ action: 'keep' }],
        removed: [{ action: 'legacy', args: { exact: true } }],
      },
    })
    const material = fieldMaterial('test.input')
    const definition = contract('test.input', 'field', { events: [{ name: 'keep' }] })
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        graph: graph([node]),
        node,
        nodes: [node],
        material,
        componentDefinition: definition,
        diagnostics: [],
      },
    })

    await wrapper.get('[data-property-tab="events"]').trigger('click')
    const remove = wrapper.get('[data-stale-kind="event-unknown"] [data-stale-remove]')
    expect(remove.attributes('aria-label')).toContain('removed')
    await remove.trigger('click')
    expect(wrapper.emitted('removeStoredConfig')).toEqual([['legacy', ['events', 'removed']]])

    await wrapper.setProps({ readonly: true })
    expect(wrapper.get('[data-stale-remove]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-stale-remove]').trigger('click')
    expect(wrapper.emitted('removeStoredConfig')).toHaveLength(1)
  })

  it('identifies the owning node in same-key stale removal names', async () => {
    const staleKey = 'legacy.configuration.key.that.must.remain.fully.readable'
    const first = field('first', 'test.first', {
      label: 'First field',
      events: { [staleKey]: [{ action: 'first' }] },
    })
    const second = field('second', 'test.second', {
      label: 'Second field',
      events: { [staleKey]: [{ action: 'second' }] },
    })
    const firstMaterial = fieldMaterial('test.first')
    const secondMaterial = fieldMaterial('test.second')
    const firstContract = contract('test.first', 'field')
    const secondContract = contract('test.second', 'field')
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        graph: graph([first, second]),
        node: first,
        nodes: [first, second],
        material: firstMaterial,
        componentDefinition: firstContract,
        getMaterial: component => component === 'test.first' ? firstMaterial : secondMaterial,
        getComponentDefinition: component => component === 'test.first' ? firstContract : secondContract,
        diagnostics: [],
      },
    })

    await wrapper.get('[data-property-tab="events"]').trigger('click')
    expect(wrapper.findAll('.mx-config-form-designer__stale-heading code').map(code => code.text())).toEqual([
      staleKey,
      staleKey,
    ])
    expect(wrapper.findAll('[data-stale-remove]').map(button => button.attributes('aria-label'))).toEqual([
      `Delete stored configuration ${staleKey} from First field`,
      `Delete stored configuration ${staleKey} from Second field`,
    ])
  })

  it('renders each mixed validation value without enabling a destructive shared editor', async () => {
    const first = field('first', 'test.first', {
      validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'minLength', value: 2 }] },
    })
    const second = field('second', 'test.second', {
      validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'maxLength', value: 20 }] },
    })
    const firstMaterial = fieldMaterial('test.first')
    const secondMaterial = fieldMaterial('test.second')
    const firstContract = contract('test.first', 'field')
    const secondContract = contract('test.second', 'field')
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        graph: graph([first, second]),
        node: first,
        nodes: [first, second],
        material: firstMaterial,
        componentDefinition: firstContract,
        getMaterial: component => component === 'test.first' ? firstMaterial : secondMaterial,
        getComponentDefinition: component => component === 'test.first' ? firstContract : secondContract,
        diagnostics: [],
      },
    })

    await wrapper.get('[data-property-tab="validation"]').trigger('click')
    const warnings = wrapper.findAll('[data-stale-kind="validation-incompatible"]')
    expect(warnings).toHaveLength(2)
    expect(warnings[0]!.get('pre').text()).toBe(JSON.stringify(first.validation, null, 2))
    expect(warnings[1]!.get('pre').text()).toBe(JSON.stringify(second.validation, null, 2))
    expect(wrapper.get('.mx-config-form-designer__validation-editor [role="switch"]').attributes('disabled')).toBeDefined()
  })

  it('refreshes the active root span fraction without persisting derived state', async () => {
    const node = field('name', 'test.input')
    const material = fieldMaterial('test.input')
    const definition = contract('test.input', 'field')
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        graph: graph([node], { name: 8 }, { columns: 24, fieldSpan: 12 }),
        node,
        nodes: [node],
        material,
        componentDefinition: definition,
        components: {
          number: { component: NumberControl, trigger: 'change' },
        },
        diagnostics: [],
        propertyControls: {
          number: { component: 'number' },
        },
      },
    })

    const hintField = () => wrapper.get('.mx-config-form-designer-property-form__field[data-hint-label]')
    expect(hintField().attributes('data-hint-label')).toBe('8 / 24 · 1/3')
    expect(wrapper.get('[data-adapter-number][aria-label="Span"]').attributes('aria-description')).toBe('8 / 24 · 1/3')
    expect(wrapper.find('.mx-config-form-designer__stepper').exists()).toBe(false)

    await wrapper.setProps({ graph: graph([node], { name: 12 }, { columns: 24, fieldSpan: 12 }) })
    expect(hintField().attributes('data-hint-label')).toBe('12 / 24 · 1/2')
    expect(JSON.stringify(wrapper.props('graph'))).not.toContain('fraction')
  })

  it('shows the form field span fraction when no node is selected', () => {
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        graph: graph([], {}, { columns: 24, fieldSpan: 12 }),
        diagnostics: [],
      },
    })

    expect(wrapper.get('.mx-config-form-designer__setter-hint.is-value').text()).toBe('12 / 24 · 1/2')
  })

  it('edits canonical pixel gap and label width through numeric controls', async () => {
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        graph: graph([], {}, { columns: 8, fieldSpan: 12, gap: '16px', labelPosition: 'left', labelWidth: 120 }),
        components: {
          number: { component: NumberControl, trigger: 'change' },
        },
        diagnostics: [],
        propertyControls: {
          number: { component: 'number' },
        },
      },
    })
    const gap = wrapper.get('[data-adapter-number][aria-label="Gap (px)"]')
    const labelWidth = wrapper.get('[data-adapter-number][aria-label="Label width (px)"]')
    const columns = wrapper.get('[data-adapter-number][aria-label="Columns"]')
    const fieldSpan = wrapper.get('[data-adapter-number][aria-label="Field span"]')

    expect((gap.element as HTMLInputElement).value).toBe('16')
    expect((labelWidth.element as HTMLInputElement).value).toBe('120')
    expect((fieldSpan.element as HTMLInputElement).value).toBe('8')
    expect(fieldSpan.attributes('max')).toBe('8')
    expect(gap.attributes()).toMatchObject({ min: '0', max: '64', precision: '0', step: '1' })
    expect(labelWidth.attributes()).toMatchObject({ min: '0', max: '480', precision: '0', step: '1' })

    ;(gap.element as HTMLInputElement).value = '20'
    await gap.trigger('change')
    ;(labelWidth.element as HTMLInputElement).value = '144'
    await labelWidth.trigger('change')
    ;(columns.element as HTMLInputElement).value = '6'
    await columns.trigger('change')

    expect(wrapper.emitted('updateForm')?.slice(-3)).toEqual([
      [{ gap: '20px' }],
      [{ labelWidth: 144 }],
      [{ columns: 6, fieldSpan: 6 }],
    ])
  })
})
