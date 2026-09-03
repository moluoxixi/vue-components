// @vitest-environment happy-dom
import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type { ProjectCommandAction, ProjectOperation } from '@moluoxixi/config-form-model'
import type { EdgeRemoveChange, NodePositionChange } from '@vue-flow/core'
import { VueFlow } from '@vue-flow/core'
import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { FlowWorkspace } from '..'

const PAGE_ID = 'home'

function lastAction(wrapper: ReturnType<typeof mount>): ProjectCommandAction {
  const command = wrapper.emitted('command')?.at(-1)?.[0] as { actions: ProjectCommandAction[] } | undefined
  if (!command?.actions[0])
    throw new Error('Expected a ProjectCommand action.')
  return command.actions[0]
}

function appliedOperation(wrapper: ReturnType<typeof mount>): ProjectOperation {
  const action = lastAction(wrapper)
  if (action.type !== 'operation.apply' || !action.operations[0])
    throw new Error('Expected an applied ProjectOperation.')
  return action.operations[0]
}

function createFlow(id = 'existing'): ConfigFormFlow {
  return {
    version: 1,
    id,
    name: 'Existing',
    trigger: { kind: 'form.submit' },
    nodes: [
      { id: 'trigger', type: 'trigger', position: { x: 40, y: 80 } },
      { id: 'end', type: 'end', position: { x: 360, y: 80 } },
    ],
    edges: [{ id: 'next', source: 'trigger', target: 'end', condition: 'next' }],
  }
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 900 })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 560 })
})

beforeEach(() => {
  const overlays = document.createElement('div')
  overlays.id = 'workbench-overlays'
  document.body.append(overlays)
})

afterEach(() => document.body.replaceChildren())

function overlay(): DOMWrapper<HTMLElement> {
  return new DOMWrapper(document.getElementById('workbench-overlays')!)
}

function selectControl(wrapper: ReturnType<typeof mount>, id: string) {
  const control = wrapper.findAllComponents({ name: 'ElSelect' })
    .find(component => component.attributes('data-flow-control') === id)
  if (!control)
    throw new Error(`Expected Element Plus select: ${id}`)
  return control
}

describe('flowWorkspace', () => {
  it('uses an explicit locale outside the designer provider and reacts to replacements', async () => {
    const wrapper = mount(FlowWorkspace, {
      props: {
        pageId: PAGE_ID,
        flows: [],
        locale: {
          locale: 'zh-CN',
          messages: {
            'flow.workspace': '流程工作区',
            'flow.empty.title': '暂无流程',
            'flow.empty.action': '创建首个流程',
          },
        },
      },
    })

    expect(wrapper.get('.flow-workspace').attributes('aria-label')).toBe('流程工作区')
    expect(wrapper.get('.flow-empty').text()).toContain('暂无流程')

    await wrapper.setProps({
      locale: {
        locale: 'en-US',
        messages: {
          'flow.workspace': 'Localized flow workspace',
          'flow.empty.title': 'Localized empty state',
          'flow.empty.action': 'Localized create action',
        },
      },
    })

    expect(wrapper.get('.flow-workspace').attributes('aria-label')).toBe('Localized flow workspace')
    expect(wrapper.get('.flow-empty').text()).toContain('Localized empty state')
    expect(wrapper.get('[data-testid="create-first-flow"]').text()).toContain('Localized create action')
  })

  it('creates a valid trigger-to-end flow and projects it through controlled Vue Flow', async () => {
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [] } })
    await wrapper.get('[data-testid="create-first-flow"]').trigger('click')
    expect(overlay().get('[role="menu"]').attributes('aria-labelledby')).toBeDefined()
    await overlay().findAll('[role="menuitem"]').find(button => button.text().includes('Form submit'))!.trigger('click')
    const operation = appliedOperation(wrapper)
    expect(operation.type).toBe('flow.add')
    if (operation.type !== 'flow.add')
      return
    const created = operation.flow
    await wrapper.setProps({ flows: [created] })

    const vueFlow = wrapper.getComponent(VueFlow)
    expect(vueFlow.props('applyDefault')).toBe(false)
    expect((vueFlow.props('nodes') as Array<{ id: string }>).map(node => node.id)).toEqual(['flow-1-trigger', 'flow-1-end'])
    expect(created).toMatchObject({ name: 'On Form submit', trigger: { kind: 'form.submit' } })
    expect(created.edges).toEqual([{ id: 'flow-1-next', source: 'flow-1-trigger', target: 'flow-1-end', condition: 'next' }])
    expect(wrapper.get('.flow-list-item small').text()).toBe('Form submit')
    expect(wrapper.get('[data-node-id="flow-1-trigger"] strong').text()).toBe('Form submit')
  })

  it('focuses an existing event handler or opens event-first creation for an unhandled inspector event', async () => {
    const target = { nodeId: 'submit', nodeLabel: 'Submit', component: 'element.button', event: 'click', eventLabel: 'Click' }
    const existing = { ...createFlow('existing-click'), trigger: { kind: 'component.event', nodeId: 'submit', event: 'click' } } as ConfigFormFlow
    const wrapper = mount(FlowWorkspace, {
      props: {
        pageId: PAGE_ID,
        flows: [createFlow('submit-flow'), existing],
        eventTargets: [target],
        initialTrigger: { kind: 'component.event', nodeId: 'submit', event: 'click' },
      },
    })

    expect(wrapper.get('.flow-list-item.is-active span').text()).toBe('Existing')
    expect(overlay().find('[role="menu"]').isVisible()).toBe(false)

    await wrapper.setProps({
      initialTrigger: { kind: 'component.event', nodeId: 'submit', event: 'change' },
    })
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(overlay().get('[role="menu"]').isVisible()).toBe(true)
  })

  it('creates a component event flow from the exact registered node event', async () => {
    const wrapper = mount(FlowWorkspace, {
      props: {
        pageId: PAGE_ID,
        flows: [],
        eventTargets: [
          { nodeId: 'submit', nodeLabel: 'Submit', component: 'element.button', event: 'click', eventLabel: 'Click' },
        ],
        initialTrigger: { kind: 'component.event', nodeId: 'submit', event: 'click' },
      },
    })

    const preferred = overlay().get('[role="menuitem"].is-preferred')
    expect(preferred.text()).toContain('Submit · Click')
    await preferred.trigger('click')

    const operation = appliedOperation(wrapper)
    expect(operation.type).toBe('flow.add')
    if (operation.type !== 'flow.add')
      return
    expect(operation.flow).toMatchObject({
      name: 'On Submit · Click',
      trigger: { kind: 'component.event', nodeId: 'submit', event: 'click' },
    })
  })

  it('keeps condition branches explicit when adding a condition node', async () => {
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [createFlow()] } })
    await wrapper.get('[data-testid="add-condition"]').trigger('click')
    const updated = lastAction(wrapper)
    expect(updated.type).toBe('flow.graph')
    if (updated.type !== 'flow.graph')
      return
    const condition = updated.nodes.find(node => node.type === 'condition')!
    expect(updated.edges.filter(edge => edge.source === condition.id).map(edge => edge.condition).sort()).toEqual(['false', 'true'])
  })

  it('uses a registered field when selecting a field-change trigger', async () => {
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [createFlow('field-flow')], fieldNames: ['email'] } })
    selectControl(wrapper, 'trigger').vm.$emit('change', 'field.change')
    await wrapper.vm.$nextTick()
    const updated = lastAction(wrapper)
    expect(updated.type).toBe('flow.settings')
    if (updated.type !== 'flow.settings')
      return
    expect(updated.settings.trigger).toEqual({ kind: 'field.change', field: 'email' })
  })

  it('uses a registered node event when selecting a component-event trigger', async () => {
    const wrapper = mount(FlowWorkspace, {
      props: {
        pageId: PAGE_ID,
        flows: [createFlow('event-flow')],
        eventTargets: [
          { nodeId: 'submit', nodeLabel: 'Submit', component: 'element.input', event: 'change', eventLabel: 'Change' },
        ],
      },
    })

    selectControl(wrapper, 'trigger').vm.$emit('change', 'component.event')
    await wrapper.vm.$nextTick()
    const updated = lastAction(wrapper)
    expect(updated.type).toBe('flow.settings')
    if (updated.type !== 'flow.settings')
      return
    expect(updated.settings.trigger).toEqual({ kind: 'component.event', nodeId: 'submit', event: 'change' })

    await wrapper.setProps({ flows: [{ ...createFlow('event-flow'), trigger: updated.settings.trigger } as ConfigFormFlow] })
    expect(String(selectControl(wrapper, 'event-target').props('modelValue'))).toContain('submit')
  })

  it('keeps component-event selection unavailable without registry targets', async () => {
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [createFlow('event-flow')] } })
    const option = selectControl(wrapper, 'trigger').findAllComponents({ name: 'ElOption' }).find(
      component => component.props('value') === 'component.event',
    )
    expect(option?.props('disabled')).toBe(true)
  })

  it('preserves readonly and numeric boundaries through Element Plus controls', async () => {
    const readonlyWrapper = mount(FlowWorkspace, {
      props: { pageId: PAGE_ID, flows: [createFlow('readonly-flow')], readonly: true },
    })
    expect(readonlyWrapper.findAllComponents({ name: 'ElSelect' })
      .every(control => control.props('disabled') === true)).toBe(true)
    const readonlyTimeout = readonlyWrapper.getComponent({ name: 'ElInputNumber' })
    expect(readonlyTimeout.props()).toMatchObject({ disabled: true, min: 0, step: 100 })
    readonlyTimeout.vm.$emit('change', 1200)
    await readonlyWrapper.vm.$nextTick()
    expect(readonlyWrapper.emitted('command')).toBeUndefined()

    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [createFlow('timeout-flow')] } })
    const timeout = wrapper.getComponent({ name: 'ElInputNumber' })
    timeout.vm.$emit('change', -1)
    timeout.vm.$emit('change', 12.5)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('command')).toBeUndefined()

    timeout.vm.$emit('change', 1200)
    await wrapper.vm.$nextTick()
    const updated = lastAction(wrapper)
    expect(updated.type).toBe('flow.settings')
    if (updated.type !== 'flow.settings')
      return
    expect(updated.settings.errorPolicy).toEqual({ onError: 'end', timeoutMs: 1200 })
  })

  it('keeps both condition branches when adding a node after a condition', async () => {
    const flow = createFlow('branch-flow')
    flow.nodes.splice(1, 0, { id: 'condition', type: 'condition', config: { condition: { kind: 'literal', value: true } } })
    flow.edges = [
      { id: 'trigger-condition', source: 'trigger', target: 'condition', condition: 'next' },
      { id: 'condition-true', source: 'condition', target: 'end', condition: 'true' },
      { id: 'condition-false', source: 'condition', target: 'end', condition: 'false' },
    ]
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [flow] } })
    await wrapper.get('[data-testid="add-action"]').trigger('click')
    const updated = lastAction(wrapper)
    expect(updated.type).toBe('flow.graph')
    if (updated.type !== 'flow.graph')
      return
    const action = updated.nodes.find(node => node.type === 'action')!
    expect(updated.edges.filter(edge => edge.target === action.id).map(edge => edge.condition).sort()).toEqual(['false', 'true'])
    expect(updated.edges.filter(edge => edge.source === action.id).map(edge => edge.condition)).toEqual(['next'])
  })

  it('commits a node position only through a controlled model update', async () => {
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [createFlow()] } })
    wrapper.getComponent(VueFlow).vm.$emit('nodesChange', [{
      id: 'trigger',
      type: 'position',
      from: { x: 40, y: 80 },
      position: { x: 80, y: 120 },
      dragging: true,
    } satisfies NodePositionChange])
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('command')).toBeUndefined()

    const change: NodePositionChange = {
      id: 'trigger',
      type: 'position',
      from: { x: 40, y: 80 },
      position: { x: 96.4, y: 144.7 },
      dragging: false,
    }
    wrapper.getComponent(VueFlow).vm.$emit('nodesChange', [change])
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('command')).toHaveLength(1)
    const updated = lastAction(wrapper)
    expect(updated.type).toBe('flow.node')
    if (updated.type !== 'flow.node')
      return
    expect(updated.node.position).toEqual({ x: 96, y: 145 })
  })

  it('rejects an edge deletion that would leave the trigger as a dead end', async () => {
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [createFlow()] } })
    const change: EdgeRemoveChange = {
      id: 'next',
      type: 'remove',
      source: 'trigger',
      target: 'end',
      sourceHandle: 'next',
      targetHandle: 'input',
    }
    wrapper.getComponent(VueFlow).vm.$emit('edgesChange', [change])
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('command')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('must connect to a next node')
  })

  it('emits a semantic remove operation for one flow', async () => {
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [createFlow()] } })
    await wrapper.get('[aria-label="Delete flow"]').trigger('click')
    expect(appliedOperation(wrapper)).toEqual({ type: 'flow.remove', pageId: PAGE_ID, flowId: 'existing' })
  })
})
