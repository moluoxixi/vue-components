import type { ComponentContract, SurfaceGraph, SurfaceNode } from '@moluoxixi/config-form-model'
import type { DesignerMaterialDefinition, DesignerPropertySetterDefinition } from '../src/registry'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { SURFACE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { mount } from '@vue/test-utils'
import { ElOption, ElSelect } from 'element-plus'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
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
  values: Partial<Extract<SurfaceNode, { kind: 'field' }>> = {},
): Extract<SurfaceNode, { kind: 'field' }> {
  return {
    id,
    component,
    kind: 'field',
    field: id,
    props: {},
    datasetBindings: {},
    ...values,
  }
}

function graph(nodes: SurfaceNode[], spans: Record<string, number> = {}, form: SurfaceGraph['form'] = {}): SurfaceGraph {
  return {
    version: SURFACE_GRAPH_VERSION,
    props: {},
    form,
    root: nodes.map(node => ({
      nodeId: node.id,
      placement: (spans[node.id] === undefined ? {} : { span: spans[node.id]! }) as SurfaceGraph['root'][number]['placement'],
    })),
    nodesById: Object.fromEntries(nodes.map(node => [node.id, node])),
  }
}

function contract(key: string, overrides: Partial<ComponentContract> = {}): ComponentContract {
  return {
    key,
    version: '1',
    kind: 'field',
    props: [],
    bindings: [],
    semanticTriggers: ['activate'],
    stateProjectionProperties: [],
    datasetBindings: [],
    resourceBindings: [],
    slots: [],
    allowedParents: [],
    defaults: {},
    ...overrides,
  }
}

function fieldMaterial(
  key: string,
  setters: DesignerPropertySetterDefinition[] = [],
): DesignerMaterialDefinition {
  return {
    key,
    version: 1,
    kind: 'field',
    title: key,
    category: 'Fields',
    runtime: { component: 'input' },
    setters,
    createNode: ({ id }) => ({ id, field: id, kind: 'field', component: key }),
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: originalScrollIntoView,
  })
})

describe('designer property panel lite Inspector', () => {
  it('renders and refreshes Dataset options for the default setter without publishing an edit', async () => {
    const node = field('choice', 'test.select', {
      defaultValue: 2,
      props: { options: [{ label: 'Stale', value: 'stale' }] },
      datasetBindings: { options: { datasetId: 'choices', projection: { kind: 'options', valuePath: ['id'], labelPath: ['name'] } } },
    })
    const wrapper = mount(DesignerPropertyPanel, { props: {
      renderer: ConfigFormRenderer,
      graph: graph([node]),
      node,
      material: fieldMaterial('test.select', [{ key: 'defaultValue', label: 'Default', path: ['defaultValue'], control: 'defaultValue', valueKind: 'select', optionsPath: ['props', 'options'] }]),
      componentDefinition: contract('test.select'),
      datasets: [{ id: 'choices', name: 'Choices', rows: [{ id: 2, name: 'Two' }] }],
      diagnostics: [],
    } })
    const control = wrapper.getComponent(ElSelect)
    expect(control.props('modelValue')).toBe(2)
    expect(control.findAllComponents(ElOption).map(option => option.props())).toEqual([expect.objectContaining({ label: 'Two', value: 2 })])
    await wrapper.setProps({ datasets: [{ id: 'choices', name: 'Choices', rows: [{ id: 3, name: 'Three' }] }] })
    expect(control.findAllComponents(ElOption).map(option => option.props())).toEqual([expect.objectContaining({ label: 'Three', value: 3 })])
    expect(wrapper.emitted('updatePath')).toBeUndefined()
    expect(wrapper.emitted('updatePaths')).toBeUndefined()
    wrapper.unmount()
  })

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
        renderer: ConfigFormRenderer,
        graph: graph([node]),
        node,
        material: fieldMaterial('test.input', [setter]),
        componentDefinition: contract('test.input'),
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
    expect(control.element.closest('.mx-config-form-designer-property-form__field')?.classList)
      .toContain('is-control-default-value')
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
        renderer: ConfigFormRenderer,
        graph: graph([node]),
        node,
        material: fieldMaterial('test.input', [setter]),
        componentDefinition: contract('test.input'),
        diagnostics: [],
      },
    })

    expect(wrapper.get('.mx-config-form-designer__default-value input').attributes('aria-label'))
      .toBe('Default value')
  })

  it('commits Required and its message as independent field settings', async () => {
    const node = field('name', 'test.input')
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
        graph: graph([node]),
        node,
        material: fieldMaterial('test.input'),
        componentDefinition: contract('test.input'),
        diagnostics: [],
      },
    })

    await wrapper.get('[data-property-tab="validation"]').trigger('click')
    await wrapper.get('input[aria-label="Required"]').setValue(true)
    const message = wrapper.get('input[aria-label="Required message"]')
    await message.setValue('Name is required')
    await message.trigger('blur')

    expect(wrapper.emitted('updatePath')).toEqual([
      ['name', ['required'], true],
      ['name', ['requiredMessage'], 'Name is required'],
    ])
  })

  it('keeps Required and validate-on for time fields without exposing generic validation', async () => {
    const node = field('startTime', 'test.time', {
      validation: { version: 2, base: { type: 'date' }, rules: [{ kind: 'dateMin', value: '2026-01-01T00:00:00.000Z' }] },
      validateOn: 'change',
    })
    const setter: DesignerPropertySetterDefinition = {
      key: 'defaultValue',
      label: 'Default value',
      path: ['defaultValue'],
      control: 'defaultValue',
      valueKind: 'time',
    }
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
        graph: graph([node]),
        node,
        material: fieldMaterial('test.time', [setter]),
        componentDefinition: contract('test.time'),
        diagnostics: [],
      },
    })

    await wrapper.get('[data-property-tab="validation"]').trigger('click')
    expect(wrapper.find('input[aria-label="Required"]').exists()).toBe(true)
    expect(wrapper.find('.mx-config-form-designer__validate-on').exists()).toBe(true)
    expect(wrapper.find('.mx-config-form-designer__validation-editor').exists()).toBe(false)
  })

  it('renders properties, validation, and interactions tabs with keyboard navigation', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    const node = field('name', 'test.input')
    const wrapper = mount(DesignerPropertyPanel, {
      attachTo: document.body,
      props: {
        renderer: ConfigFormRenderer,
        graph: graph([node]),
        node,
        material: fieldMaterial('test.input', [placeholderSetter]),
        componentDefinition: contract('test.input'),
        diagnostics: [],
      },
    })

    expect(wrapper.findAll('[role="tab"]').map(tab => tab.attributes('data-property-tab')))
      .toEqual(['properties', 'validation', 'interactions'])
    const properties = wrapper.get('[data-property-tab="properties"]')
    ;(properties.element as HTMLElement).focus()
    await properties.trigger('keydown', { key: 'End' })
    const interactions = wrapper.get('[data-property-tab="interactions"]')
    expect(interactions.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(interactions.element)
    await interactions.trigger('keydown', { key: 'ArrowRight' })
    expect(properties.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(properties.element)
    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('filters component properties by label, field, or path and clears stale queries on selection changes', async () => {
    const first = field('customerName', 'test.input', {
      label: 'Customer name',
      props: { autocomplete: 'name', clearable: true, maxlength: 80, placeholder: 'Type a name', showWordLimit: true },
    })
    const second = field('contactEmail', 'test.input', {
      label: 'Contact email',
      props: { autocomplete: 'email', clearable: false, maxlength: 120, placeholder: 'name@example.com', showWordLimit: false },
    })
    const setters: DesignerPropertySetterDefinition[] = [
      { key: 'autocomplete', label: 'Autocomplete', path: ['props', 'autocomplete'], control: 'text' },
      { key: 'clearable', label: 'Clearable', path: ['props', 'clearable'], control: 'boolean' },
      { key: 'maxlength', label: 'Max length', path: ['props', 'maxlength'], control: 'number' },
      placeholderSetter,
      { key: 'showWordLimit', label: 'Show word limit', path: ['props', 'showWordLimit'], control: 'boolean' },
    ]
    const material = fieldMaterial('test.input', setters)
    const definition = contract('test.input')
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
        graph: graph([first]),
        node: first,
        material,
        componentDefinition: definition,
        diagnostics: [],
      },
    })

    const search = wrapper.get('[data-property-search]')
    expect(wrapper.findAll('[data-property-group]').map(group => group.attributes('data-property-group')))
      .toEqual(['field', 'layout', 'component'])
    await search.setValue('placeholder')
    expect(wrapper.find('input[aria-label="Placeholder"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label="Autocomplete"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-property-group]').map(group => group.attributes('data-property-group')))
      .toEqual(['component'])
    expect(wrapper.get('.mx-config-form-designer__search-count').text()).toBe('1 / 8')

    await search.setValue('maxlength')
    expect(wrapper.find('input[aria-label="Max length"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label="Placeholder"]').exists()).toBe(false)

    await search.setValue('missing-property')
    expect(wrapper.find('[data-property-empty]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label="Placeholder"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="Clear property search"]').trigger('click')
    expect(wrapper.find('input[aria-label="Autocomplete"]').exists()).toBe(true)

    await search.setValue('layout')
    expect(wrapper.find('[data-property-group="layout"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label="Span"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label="Placeholder"]').exists()).toBe(false)

    await search.setValue('missing-property')
    await wrapper.setProps({ graph: graph([second]), node: second })
    expect((wrapper.get('[data-property-search]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('[data-property-empty]').exists()).toBe(false)
    expect(wrapper.get('.mx-config-form-designer__property-identity strong').text()).toBe('Contact email')
  })

  it('returns to expanded properties when the canvas selection changes', async () => {
    const first = field('first', 'test.input')
    const second = field('second', 'test.input')
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
        graph: graph([first, second]),
        node: first,
        material: fieldMaterial('test.input', [placeholderSetter]),
        componentDefinition: contract('test.input'),
        diagnostics: [],
      },
    })

    await wrapper.get('[data-property-tab="interactions"]').trigger('click')
    const componentGroup = wrapper.get('[data-property-group="component"] button')
    await componentGroup.trigger('click')
    expect(componentGroup.attributes('aria-expanded')).toBe('false')

    await wrapper.setProps({ graph: graph([second]), node: second })

    expect(wrapper.get('[data-property-tab="properties"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-property-group="component"] button').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('input[aria-label="Placeholder"]').exists()).toBe(true)
  })

  it('uses only compatible common setters for heterogeneous selections', async () => {
    const first = field('first', 'test.first')
    const second = field('second', 'test.second')
    const firstMaterial = fieldMaterial('test.first', [
      placeholderSetter,
      { key: 'clearable', label: 'Clearable', path: ['props', 'clearable'], control: 'boolean' },
    ])
    const secondMaterial = fieldMaterial('test.second', [
      { ...placeholderSetter },
      { key: 'clearable', label: 'Clear mode', path: ['props', 'clearable'], control: 'select', options: [] },
    ])
    const firstContract = contract('test.first')
    const secondContract = contract('test.second')
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
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

    expect(wrapper.text()).toContain('Placeholder')
    expect(wrapper.text()).not.toContain('Clearable')
    const placeholder = wrapper.get('input[aria-label="Placeholder"]')
    await placeholder.setValue('Shared hint')
    await placeholder.trigger('blur')
    expect(wrapper.emitted('updatePaths')?.at(-1)).toEqual([
      ['first', 'second'],
      ['props', 'placeholder'],
      'Shared hint',
    ])
  })

  it('keeps both sections read-only when material metadata is missing', async () => {
    const node = field('enabled', 'test.switch')
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
        graph: graph([node]),
        node,
        componentDefinition: contract('test.switch'),
        diagnostics: [],
      },
    })

    expect(wrapper.findAll('[role="tab"]').map(tab => tab.attributes('data-property-tab')))
      .toEqual(['properties', 'validation', 'interactions'])
    await wrapper.get('[data-property-tab="validation"]').trigger('click')
    expect(wrapper.get('input[aria-label="Required"]').attributes('disabled'))
      .toBeDefined()
  })

  it('edits shared Required without exposing different RuleSets as one editor', async () => {
    const first = field('first', 'test.first', {
      validation: { version: 2, base: { type: 'string' }, rules: [{ kind: 'minLength', value: 2 }] },
    })
    const second = field('second', 'test.second', {
      validation: { version: 2, base: { type: 'string' }, rules: [{ kind: 'maxLength', value: 20 }] },
    })
    const firstMaterial = fieldMaterial('test.first')
    const secondMaterial = fieldMaterial('test.second')
    const firstContract = contract('test.first')
    const secondContract = contract('test.second')
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
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
    expect(wrapper.find('.mx-config-form-designer__validation-editor').exists()).toBe(false)
    const required = wrapper.get('input[aria-label="Required"]')
    expect(required.attributes('disabled')).toBeUndefined()
    await required.setValue(true)
    expect(wrapper.emitted('updatePaths')?.at(-1)).toEqual([
      ['first', 'second'],
      ['required'],
      true,
    ])
  })

  it('has no event, Flow, binding, condition, or reaction authoring surface', () => {
    const node = field('name', 'test.input')
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
        graph: graph([node]),
        node,
        material: fieldMaterial('test.input'),
        componentDefinition: contract('test.input'),
        diagnostics: [],
      },
    })

    expect(wrapper.find('[data-property-tab="events"]').exists()).toBe(false)
    expect(wrapper.find('[data-property-tab="bindings"]').exists()).toBe(false)
    expect(wrapper.find('[data-property-tab="conditions"]').exists()).toBe(false)
    expect(wrapper.find('[data-property-tab="reactions"]').exists()).toBe(false)
    expect(wrapper.find('[data-form-event]').exists()).toBe(false)
    expect(wrapper.find('.mx-config-form-designer__form-events').exists()).toBe(false)
    expect(wrapper.emitted()).not.toHaveProperty('configureEvent')
    expect(wrapper.emitted()).not.toHaveProperty('configureFlow')
  })

  it('authors Dataset bindings, preserves query fields, and materializes options explicitly', async () => {
    const node = field('role', 'test.select', {
      props: { options: [{ label: 'Inline', value: 'inline' }] },
      datasetBindings: {
        options: {
          datasetId: 'roles',
          projection: { kind: 'options', labelPath: ['meta', 'label'], valuePath: ['id'] },
          query: { sort: [{ path: ['rank'], direction: 'asc' }], page: { index: 0, size: 10 } },
        },
      },
    })
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
        graph: graph([node]),
        node,
        material: fieldMaterial('test.select', [
          placeholderSetter,
          { key: 'clearable', label: 'Clearable', path: ['props', 'clearable'], control: 'boolean' },
        ]),
        componentDefinition: contract('test.select', {
          datasetBindings: [{ key: 'options', projectionKinds: ['options'] }],
        }),
        datasets: [{
          id: 'roles',
          name: 'Roles',
          rows: [{ id: 1, rank: 1, meta: { label: 'Designer' } }],
        }],
        diagnostics: [],
      },
    })

    expect(wrapper.find('[data-data-binding-editor]').exists()).toBe(true)
    await wrapper.get('[data-property-search]').setValue('unmatched')
    expect(wrapper.find('[data-property-empty]').exists()).toBe(true)
    expect(wrapper.find('[data-data-binding-editor]').exists()).toBe(true)
    await wrapper.get('button[aria-label="Clear property search"]').trigger('click')
    await wrapper.get('[data-apply-dataset-binding]').trigger('click')
    expect(wrapper.emitted('updateDatasetBinding')?.at(-1)).toEqual([
      'role',
      'options',
      {
        datasetId: 'roles',
        projection: { kind: 'options', labelPath: ['meta', 'label'], valuePath: ['id'] },
        query: { sort: [{ path: ['rank'], direction: 'asc' }], page: { index: 0, size: 10 } },
      },
    ])
    await wrapper.get('[data-materialize-options]').trigger('click')
    expect(wrapper.emitted('materializeOptionsSnapshot')?.at(-1)).toEqual(['role', 'options'])
  })

  it('saves inline options as a Dataset and filters Resource choices by media capability', async () => {
    const node = field('role', 'test.select', {
      props: { options: [{ label: 'Inline', value: 'inline' }] },
    })
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
        graph: graph([node]),
        node,
        material: fieldMaterial('test.select'),
        componentDefinition: contract('test.select', {
          datasetBindings: [{ key: 'options', projectionKinds: ['options'] }],
          resourceBindings: [{ key: 'image', mediaTypes: ['image/*'] }],
        }),
        resources: [
          { id: 'logo', name: 'Logo', kind: 'url', url: '/logo.png', mediaType: 'image/png' },
          { id: 'manual', name: 'Manual', kind: 'url', url: '/manual.pdf', mediaType: 'application/pdf' },
        ],
        diagnostics: [],
      },
    })

    await wrapper.get('[data-save-options-dataset]').trigger('click')
    expect(wrapper.emitted('saveOptionsAsDataset')?.at(-1)).toEqual(['role', 'options', 'role options'])

    const resourceSelect = wrapper.findAllComponents(ElSelect)
      .find(component => component.attributes('data-resource-select') !== undefined)
    expect(resourceSelect).toBeDefined()
    expect(resourceSelect!.findAllComponents({ name: 'ElOption' }).map(option => option.props('value')))
      .toEqual(['logo'])
    resourceSelect!.vm.$emit('update:modelValue', 'logo')
    await nextTick()
    expect(wrapper.emitted('updateResourceBinding')?.at(-1)).toEqual(['role', 'image', 'logo'])
  })

  it('refreshes the active root span fraction without persisting derived state', async () => {
    const node = field('name', 'test.input')
    const material = fieldMaterial('test.input')
    const definition = contract('test.input')
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
        graph: graph([node], { name: 8 }, { columns: 24, fieldSpan: 12 }),
        node,
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
    await wrapper.setProps({ graph: graph([node], { name: 12 }, { columns: 24, fieldSpan: 12 }) })
    expect(hintField().attributes('data-hint-label')).toBe('12 / 24 · 1/2')
    expect(JSON.stringify(wrapper.props('graph'))).not.toContain('fraction')
  })

  it('shows the form field span fraction when no node is selected', () => {
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
        graph: graph([], {}, { columns: 24, fieldSpan: 12 }),
        diagnostics: [],
      },
    })

    expect(wrapper.get('.mx-config-form-designer-property-form__field[data-hint-label]')
      .attributes('data-hint-label')).toBe('12 / 24 · 1/2')
  })

  it('keeps the Surface interaction overview discoverable without a selected node', async () => {
    const node = field('name', 'test.input')
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
        graph: graph([node]),
        getComponentDefinition: () => contract('test.input'),
        diagnostics: [],
      },
    })

    expect(wrapper.findAll('[role="tab"]').map(tab => tab.attributes('data-property-tab')))
      .toEqual(['properties', 'interactions'])
    await wrapper.get('[data-property-tab="interactions"]').trigger('click')
    expect(wrapper.find('[data-interaction-editor]').exists()).toBe(true)
    expect(wrapper.find('[data-property-tab="validation"]').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="Add state rule"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Add value rule"]').attributes('disabled')).toBeUndefined()
  })

  it('edits canonical pixel gap and label width through numeric controls', async () => {
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        renderer: ConfigFormRenderer,
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
