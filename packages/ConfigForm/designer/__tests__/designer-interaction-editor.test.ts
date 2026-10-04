import type {
  ComponentContract,
  ProjectSurface,
  PrototypeInteraction,
  SurfaceGraph,
  SurfaceNode,
} from '@moluoxixi/config-form-model'
import type { VueWrapper } from '@vue/test-utils'
import { SURFACE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { mount } from '@vue/test-utils'
import { ElCheckbox, ElOption, ElSelect } from 'element-plus'
import { describe, expect, it } from 'vitest'
import DesignerSafeExpressionEditor from '../src/components/DesignerPropertyPanel/components/DesignerInteractionEditor/components/DesignerSafeExpressionEditor/index.vue'
import DesignerInteractionEditor from '../src/components/DesignerPropertyPanel/components/DesignerInteractionEditor/index.vue'

const actionNode: SurfaceNode = {
  id: 'save-action',
  component: 'test.action',
  kind: 'element',
  props: {},
}

const nameField: SurfaceNode = {
  id: 'name-field',
  component: 'test.input',
  kind: 'field',
  field: 'name',
  label: 'Name',
  props: {},
  datasetBindings: {},
}

const statusField: SurfaceNode = {
  id: 'status-field',
  component: 'test.input',
  kind: 'field',
  field: 'status',
  label: 'Status',
  props: {},
  datasetBindings: {},
}

const graph: SurfaceGraph = {
  version: SURFACE_GRAPH_VERSION,
  props: {},
  form: {},
  root: [actionNode, nameField, statusField].map(node => ({ nodeId: node.id, placement: {} })),
  nodesById: Object.fromEntries([actionNode, nameField, statusField].map(node => [node.id, node])),
}

const actionContract: ComponentContract = {
  key: 'test.action',
  version: '1',
  kind: 'element',
  semanticTriggers: ['activate', 'submit'],
  stateProjectionProperties: [],
  datasetBindings: [],
  resourceBindings: [],
  props: [],
  bindings: [],
  slots: [],
  allowedParents: [],
  defaults: {},
}

const fieldContract: ComponentContract = {
  ...actionContract,
  key: 'test.input',
  kind: 'field',
  semanticTriggers: [],
}

function surface(
  id: string,
  kind: ProjectSurface['kind'],
  outputs: string[] = [],
): ProjectSurface {
  const base = {
    id,
    name: id,
    graph,
    interactions: [] as PrototypeInteraction[],
    outputs: outputs.map(name => ({ name })),
    parameters: [],
  }
  if (kind === 'page')
    return { ...base, kind, route: `/${id}` }
  if (kind === 'dialog') {
    return {
      ...base,
      kind,
      presentation: {
        kind,
        title: id,
        width: { desktop: { value: 480, unit: 'px' } },
        mask: true,
        close: { escape: true, mask: true, button: true },
      },
    }
  }
  return {
    ...base,
    kind,
    presentation: {
      kind,
      title: id,
      placement: 'right',
      size: { desktop: { value: 40, unit: '%' } },
      mask: true,
      close: { escape: true, mask: true, button: true },
    },
  }
}

const surfaces = [
  surface('home', 'page'),
  surface('editor', 'dialog', ['saved', 'cancelled']),
  surface('details', 'drawer', ['selected']),
]

function mountEditor(interactions: PrototypeInteraction[], surfaceId = 'home', node: SurfaceNode | null = actionNode) {
  return mount(DesignerInteractionEditor, {
    props: {
      componentDefinition: actionContract,
      getComponentDefinition: component => component === 'test.action' ? actionContract : fieldContract,
      graph,
      interactions,
      ...(node ? { node } : {}),
      surfaceId,
      surfaces,
    },
  })
}

function selectByLabel(wrapper: VueWrapper, label: string) {
  const select = wrapper.findAllComponents(ElSelect)
    .find(candidate => candidate.attributes('aria-label') === label || candidate.props('ariaLabel') === label)
  if (!select)
    throw new Error(`Missing select: ${label}`)
  return select
}

describe('designer interaction editor', () => {
  it('keeps Surface interactions visible without a selected node', async () => {
    const interactions: PrototypeInteraction[] = [{
      kind: 'stateProjection',
      id: 'surface-visible',
      target: { kind: 'state', nodeId: 'name-field', key: 'visible' },
      value: { version: 1, ast: { kind: 'literal', value: true } },
    }]
    const wrapper = mountEditor(interactions, 'home', null)

    expect(wrapper.get('[data-interaction-id="surface-visible"]')).toBeTruthy()
    expect(wrapper.get('button[aria-label="Add state rule"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Add primary action"]').attributes('disabled')).toBeDefined()
    const addValue = wrapper.get('button[aria-label="Add value rule"]')
    expect(addValue.attributes('disabled')).toBeUndefined()
    await addValue.trigger('click')
    expect(wrapper.emitted('update')?.at(-1)?.[0]).toHaveLength(2)
    expect(wrapper.get('[data-interaction-filter="valueChange"]').attributes('aria-pressed')).toBe('true')
  })

  it('renders all state projections and value action kinds', () => {
    const interactions: PrototypeInteraction[] = [
      ...(['visible', 'disabled', 'readonly', 'required'] as const).map(key => ({
        kind: 'stateProjection' as const,
        id: `state-${key}`,
        target: { kind: 'state' as const, nodeId: 'name-field', key },
        value: { version: 1 as const, ast: { kind: 'literal' as const, value: true } },
      })),
      {
        kind: 'valueChange',
        id: 'value-set',
        dependencies: ['status-field'],
        action: {
          kind: 'set',
          targetFieldId: 'name-field',
          value: { version: 1, ast: { kind: 'literal', value: 'Set' } },
        },
      },
      {
        kind: 'valueChange',
        id: 'value-copy',
        dependencies: ['status-field'],
        action: { kind: 'copy', sourceFieldId: 'status-field', targetFieldId: 'name-field' },
      },
      {
        kind: 'valueChange',
        id: 'value-clear',
        dependencies: ['status-field'],
        action: { kind: 'clear', targetFieldId: 'name-field' },
      },
    ]
    const wrapper = mountEditor(interactions)

    expect(wrapper.findAll('[data-interaction-id^="state-"]')).toHaveLength(4)
    expect(wrapper.findAllComponents(ElSelect)
      .filter(select => select.attributes('aria-label') === 'Projected state' || select.props('ariaLabel') === 'Projected state')
      .map(select => select.props('modelValue'))).toEqual([
      'visible',
      'disabled',
      'readonly',
      'required',
    ])
    expect(wrapper.findAllComponents(ElSelect)
      .filter(select => select.attributes('aria-label') === 'Value action' || select.props('ariaLabel') === 'Value action')
      .map(select => select.props('modelValue'))).toEqual(['set', 'copy', 'clear'])
  })

  it('filters the rule list by interaction kind and keeps the counts visible', async () => {
    const wrapper = mountEditor([
      {
        kind: 'stateProjection',
        id: 'state-visible',
        target: { kind: 'state', nodeId: 'name-field', key: 'visible' },
        value: { version: 1, ast: { kind: 'literal', value: true } },
      },
      {
        kind: 'valueChange',
        id: 'value-clear',
        dependencies: ['status-field'],
        action: { kind: 'clear', targetFieldId: 'name-field' },
      },
      {
        kind: 'primaryUiAction',
        id: 'primary',
        nodeId: 'save-action',
        trigger: 'activate',
        action: { kind: 'navigate', targetSurfaceId: 'home', parameters: [] },
      },
    ])

    expect(wrapper.findAll('[data-interaction-id]')).toHaveLength(3)
    expect(wrapper.get('[data-interaction-filter="all"]').text()).toContain('3')
    expect(wrapper.get('[data-interaction-filter="stateProjection"]').text()).toContain('1')
    expect(wrapper.get('[data-interaction-filter="valueChange"]').text()).toContain('1')
    expect(wrapper.get('[data-interaction-filter="primaryUiAction"]').text()).toContain('1')

    await wrapper.get('[data-interaction-filter="primaryUiAction"]').trigger('click')
    expect(wrapper.findAll('[data-interaction-id]')).toHaveLength(1)
    expect(wrapper.get('[data-interaction-id="primary"]')).toBeTruthy()
    expect(wrapper.get('[data-interaction-filter="primaryUiAction"]').attributes('aria-pressed')).toBe('true')

    await wrapper.get('[data-interaction-filter="all"]').trigger('click')
    expect(wrapper.findAll('[data-interaction-id]')).toHaveLength(3)
  })

  it('offers every primary action and filters page versus overlay targets', async () => {
    const wrapper = mountEditor([{
      kind: 'primaryUiAction',
      id: 'primary',
      nodeId: 'save-action',
      trigger: 'activate',
      action: { kind: 'open', targetSurfaceId: 'editor', parameters: [] },
    }])

    const action = selectByLabel(wrapper, 'Action')
    expect(action.findAllComponents(ElOption).map(option => option.props('value')))
      .toEqual(['navigate', 'back', 'open', 'closeCurrent', 'closeAll'])
    expect(selectByLabel(wrapper, 'Target surface').findAllComponents(ElOption)
      .map(option => option.props('value'))).toEqual(['editor', 'details'])

    action.vm.$emit('update:modelValue', 'navigate')
    expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject([{
      id: 'primary',
      action: { kind: 'navigate', targetSurfaceId: 'home' },
    }])
  })

  it('keeps existing rules collapsed and opens only the rule just created', async () => {
    const wrapper = mountEditor([{
      kind: 'primaryUiAction',
      id: 'primary',
      nodeId: 'save-action',
      trigger: 'activate',
      action: { kind: 'navigate', targetSurfaceId: 'home', parameters: [] },
    }])

    const toggle = wrapper.get('[data-interaction-id="primary"] .mx-config-form-designer__interaction-rule-toggle')
    expect(wrapper.get('[data-interaction-filter="all"]').attributes('aria-pressed')).toBe('true')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  it('authors named result write-back to multiple fields', async () => {
    const base: PrototypeInteraction[] = [{
      kind: 'primaryUiAction',
      id: 'primary',
      nodeId: 'save-action',
      trigger: 'activate',
      action: { kind: 'open', targetSurfaceId: 'editor', parameters: [] },
    }]
    const wrapper = mountEditor(base)
    const saved = wrapper.findAllComponents(ElCheckbox).find(item => item.text() === 'saved')
    expect(saved).toBeDefined()
    saved!.vm.$emit('update:modelValue', true)

    const firstUpdate = wrapper.emitted('update')?.at(-1)?.[0] as PrototypeInteraction[]
    expect(firstUpdate).toMatchObject([{
      id: 'primary',
      action: {
        kind: 'open',
        onResults: [{
          resultName: 'saved',
          assignments: [{
            targetFieldId: 'name-field',
            value: { version: 1, ast: { kind: 'reference', scope: 'result', path: [] } },
          }],
        }],
      },
    }])

    await wrapper.setProps({ interactions: firstUpdate })
    const add = wrapper.findAll('button').find(button => button.text() === 'Add write-back field')
    expect(add).toBeDefined()
    await add!.trigger('click')
    expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject([{
      action: {
        onResults: [{
          resultName: 'saved',
          assignments: [
            { targetFieldId: 'name-field' },
            { targetFieldId: 'status-field' },
          ],
        }],
      },
    }])
  })

  it('authors a declared output for closeCurrent', () => {
    const wrapper = mountEditor([{
      kind: 'primaryUiAction',
      id: 'close',
      nodeId: 'save-action',
      trigger: 'activate',
      action: { kind: 'closeCurrent' },
    }], 'editor')

    selectByLabel(wrapper, 'Returned result').vm.$emit('update:modelValue', 'saved')
    expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject([{
      id: 'close',
      action: {
        kind: 'closeCurrent',
        result: {
          name: 'saved',
          value: { version: 1, ast: { kind: 'reference', scope: 'values', path: ['name'] } },
        },
      },
    }])
  })
})

describe('designer safe expression editor', () => {
  it('keeps an invalid advanced draft local and does not emit it', async () => {
    const wrapper = mount(DesignerSafeExpressionEditor, {
      props: {
        fields: [{ id: 'name-field', field: 'name', label: 'Name' }],
        modelValue: { version: 1, ast: { kind: 'literal', value: true } },
      },
    })

    // Element Plus renders its segmented control with radio-like items rather
    // than native buttons. Select the Advanced JSON segment through its DOM.
    await wrapper.findAll('.el-segmented__item')[1]!.trigger('click')
    await wrapper.vm.$nextTick()
    const draft = wrapper.get('textarea[aria-label="Safe expression JSON"]')
    await draft.setValue('{ invalid')
    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect((draft.element as HTMLTextAreaElement).value).toBe('{ invalid')
    expect(wrapper.get('[role="alert"]').text()).not.toBe('')
  })
})
