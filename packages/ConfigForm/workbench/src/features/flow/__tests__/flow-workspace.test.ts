// @vitest-environment happy-dom
import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type { ProjectCommand, ProjectCommandAction, ProjectOperation } from '@moluoxixi/config-form-model'
import type { Connection, EdgeRemoveChange, NodePositionChange } from '@vue-flow/core'
import { VueFlow } from '@vue-flow/core'
import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { FlowWorkspace } from '../components'

const PAGE_ID = 'home'

function lastAction(wrapper: ReturnType<typeof mount>): ProjectCommandAction {
  const command = lastCommand(wrapper)
  if (!command?.actions[0])
    throw new Error('Expected a ProjectCommand action.')
  return command.actions[0]
}

function lastCommand(wrapper: ReturnType<typeof mount>): ProjectCommand | undefined {
  return wrapper.emitted('command')?.at(-1)?.[0] as ProjectCommand | undefined
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

describe('flowWorkspace', () => {
  it('uses an explicit locale outside the designer provider and reacts to replacements', async () => {
    const wrapper = mount(FlowWorkspace, {
      props: {
        pageId: PAGE_ID,
        flows: [],
        initialTrigger: { kind: 'form.submit' },
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
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [], initialTrigger: { kind: 'form.submit' } } })
    await wrapper.get('[data-testid="create-first-flow"]').trigger('click')
    expect(wrapper.emitted('command')).toBeUndefined()
    await wrapper.get('[data-testid="add-condition"]').trigger('click')
    const command = lastCommand(wrapper)
    expect(command).toMatchObject({ label: 'Add flow' })
    expect(command?.id).toMatch(/^flow-[a-z0-9]+-1$/)
    expect(command?.actions).toHaveLength(1)
    const operation = appliedOperation(wrapper)
    expect(operation.type).toBe('flow.add')
    if (operation.type !== 'flow.add')
      return
    const created = operation.flow
    await wrapper.setProps({ flows: [created] })

    const vueFlow = wrapper.getComponent(VueFlow)
    expect(vueFlow.props('applyDefault')).toBe(false)
    expect((vueFlow.props('nodes') as Array<{ id: string }>).map(node => node.id)).toEqual(['flow-1-trigger', 'flow-1-condition-1', 'flow-1-end'])
    expect(created).toMatchObject({ name: 'On Form submit', trigger: { kind: 'form.submit' } })
    expect(created.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'flow-1-trigger', target: 'flow-1-condition-1', condition: 'next' }),
    ]))
    expect(wrapper.get('[data-node-id="flow-1-trigger"] strong').text()).toBe('Form submit')
    expect(wrapper.get('[data-flow-control="locked-trigger"] code').text()).toBe('form.submit')
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

    expect(wrapper.get('.flow-editor-title code').text()).toBe('Submit · Click')
    expect(wrapper.get('[data-flow-control="locked-trigger"] code').text()).toBe('submit:click')

    await wrapper.setProps({
      initialTrigger: { kind: 'component.event', nodeId: 'submit', event: 'change' },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.flow-empty').text()).toContain('No flow configured')
    expect(overlay().find('[role="menu"]').exists()).toBe(false)
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

    await wrapper.get('[data-testid="create-first-flow"]').trigger('click')
    await wrapper.get('[data-testid="add-condition"]').trigger('click')

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
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [createFlow()], initialTrigger: { kind: 'form.submit' } } })
    await wrapper.get('[data-testid="add-condition"]').trigger('click')
    const updated = lastAction(wrapper)
    expect(updated.type).toBe('flow.graph')
    if (updated.type !== 'flow.graph')
      return
    const condition = updated.nodes.find(node => node.type === 'condition')!
    expect(updated.edges.filter(edge => edge.source === condition.id).map(edge => edge.condition).sort()).toEqual(['false', 'true'])
  })

  it('locks the trigger context and does not expose a trigger selector', async () => {
    const wrapper = mount(FlowWorkspace, {
      props: {
        pageId: PAGE_ID,
        flows: [{ ...createFlow('event-flow'), trigger: { kind: 'component.event', nodeId: 'submit', event: 'change' } } as ConfigFormFlow],
        eventTargets: [
          { nodeId: 'submit', nodeLabel: 'Submit', component: 'element.input', event: 'change', eventLabel: 'Change' },
        ],
        initialTrigger: { kind: 'component.event', nodeId: 'submit', event: 'change' },
      },
    })

    expect(wrapper.find('[data-flow-control="trigger"]').exists()).toBe(false)
    expect(wrapper.find('[data-flow-control="event-target"]').exists()).toBe(false)
    expect(wrapper.get('[data-flow-control="locked-trigger"] strong').text()).toBe('Submit · Change')
  })

  it('uses Element Plus text controls for flow inspector fields', async () => {
    const flow = createFlow('text-controls-flow')
    flow.nodes.splice(1, 0, { id: 'action', type: 'action', ref: 'notify', config: {} })
    flow.edges = [
      { id: 'trigger-action', source: 'trigger', target: 'action', condition: 'next' },
      { id: 'action-end', source: 'action', target: 'end', condition: 'next' },
    ]
    const wrapper = mount(FlowWorkspace, {
      props: {
        pageId: PAGE_ID,
        flows: [flow],
        initialTrigger: { kind: 'form.submit' },
      },
    })

    const nameControl = wrapper.get('[data-flow-control="name"]')
    expect(nameControl.findComponent({ name: 'ElInput' }).exists()).toBe(true)
    expect(nameControl.find('.el-input__wrapper').exists()).toBe(true)

    wrapper.getComponent(VueFlow).vm.$emit('nodesChange', [{ id: 'action', selected: true, type: 'select' }])
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[aria-label="Node ID"]').element.tagName).toBe('INPUT')
    expect(wrapper.get('[aria-label="Action ref"]').element.tagName).toBe('INPUT')
    expect(wrapper.get('[aria-label="Node config"]').element.tagName).toBe('TEXTAREA')
  })

  it('blocks editing when the current trigger has duplicate flows', async () => {
    const wrapper = mount(FlowWorkspace, {
      props: {
        pageId: PAGE_ID,
        flows: [createFlow('first'), createFlow('second')],
        initialTrigger: { kind: 'form.submit' },
      },
    })

    expect(wrapper.get('[role="alert"]').text()).toContain('multiple flows')
    expect(wrapper.get('[data-testid="add-condition"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="add-condition"]').trigger('click')
    expect(wrapper.emitted('command')).toBeUndefined()
  })

  it('preserves readonly and numeric boundaries through Element Plus controls', async () => {
    const readonlyWrapper = mount(FlowWorkspace, {
      props: { pageId: PAGE_ID, flows: [createFlow('readonly-flow')], initialTrigger: { kind: 'form.submit' }, readonly: true },
    })
    expect(readonlyWrapper.findAllComponents({ name: 'ElSelect' })
      .every(control => control.props('disabled') === true)).toBe(true)
    const readonlyTimeout = readonlyWrapper.getComponent({ name: 'ElInputNumber' })
    expect(readonlyTimeout.props()).toMatchObject({ disabled: true, min: 0, step: 100 })
    readonlyTimeout.vm.$emit('change', 1200)
    await readonlyWrapper.vm.$nextTick()
    expect(readonlyWrapper.emitted('command')).toBeUndefined()

    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [createFlow('timeout-flow')], initialTrigger: { kind: 'form.submit' } } })
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
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [flow], initialTrigger: { kind: 'form.submit' } } })
    await wrapper.get('[data-testid="add-action"]').trigger('click')
    const updated = lastAction(wrapper)
    expect(updated.type).toBe('flow.graph')
    if (updated.type !== 'flow.graph')
      return
    const action = updated.nodes.find(node => node.type === 'action')!
    expect(updated.edges.filter(edge => edge.target === action.id).map(edge => edge.condition).sort()).toEqual(['false', 'true'])
    expect(updated.edges.filter(edge => edge.source === action.id).map(edge => edge.condition)).toEqual(['next'])
  })

  it('replaces one source handle edge with a valid controlled connection', async () => {
    const flow = createFlow('connect-flow')
    flow.nodes.splice(1, 0, { id: 'action', type: 'action', ref: 'notify', config: {} })
    flow.edges.push({ id: 'action-end', source: 'action', target: 'end', condition: 'next' })
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [flow], initialTrigger: { kind: 'form.submit' } } })
    const connection: Connection = {
      source: 'trigger',
      sourceHandle: 'next',
      target: 'action',
      targetHandle: 'input',
    }

    wrapper.getComponent(VueFlow).vm.$emit('connect', connection)
    await wrapper.vm.$nextTick()

    const updated = lastAction(wrapper)
    expect(updated.type).toBe('flow.edges')
    if (updated.type !== 'flow.edges')
      return
    expect(updated.edges).toContainEqual(expect.objectContaining({ source: 'trigger', target: 'action', condition: 'next' }))
    expect(updated.edges).not.toContainEqual(expect.objectContaining({ source: 'trigger', target: 'end' }))
  })

  it('rejects deleting a node whose outgoing branches have different targets', async () => {
    const flow = createFlow('branch-delete-flow')
    flow.nodes.splice(1, 0, { id: 'condition', type: 'condition', config: { condition: { kind: 'literal', value: true } } }, { id: 'action', type: 'action', ref: 'notify', config: {} })
    flow.edges = [
      { id: 'trigger-condition', source: 'trigger', target: 'condition', condition: 'next' },
      { id: 'condition-true', source: 'condition', target: 'end', condition: 'true' },
      { id: 'condition-false', source: 'condition', target: 'action', condition: 'false' },
      { id: 'action-end', source: 'action', target: 'end', condition: 'next' },
    ]
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [flow], initialTrigger: { kind: 'form.submit' } } })

    wrapper.getComponent(VueFlow).vm.$emit('nodesChange', [{ id: 'condition', type: 'remove' }])
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('command')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('Reconnect branching paths')
  })

  it('commits object node config and increments update command ids', async () => {
    const flow = createFlow('config-flow')
    flow.nodes.splice(1, 0, { id: 'action', type: 'action', ref: 'notify', config: {} })
    flow.edges = [
      { id: 'trigger-action', source: 'trigger', target: 'action', condition: 'next' },
      { id: 'action-end', source: 'action', target: 'end', condition: 'next' },
    ]
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [flow], initialTrigger: { kind: 'form.submit' } } })
    wrapper.getComponent(VueFlow).vm.$emit('nodesChange', [{ id: 'action', selected: true, type: 'select' }])
    await wrapper.vm.$nextTick()
    await wrapper.get('textarea').setValue('{"input":{"kind":"literal","value":"saved"}}')
    await wrapper.get('textarea').trigger('blur')

    const first = lastCommand(wrapper)!
    expect(first.label).toBe('Update flow')
    expect(first.id).toMatch(/^flow-[a-z0-9]+-1$/)
    expect(lastAction(wrapper)).toMatchObject({
      type: 'flow.node',
      nodeId: 'action',
      node: { config: { input: { kind: 'literal', value: 'saved' } } },
    })

    const timeout = wrapper.getComponent({ name: 'ElInputNumber' })
    timeout.vm.$emit('change', 1200)
    await wrapper.vm.$nextTick()
    expect(lastCommand(wrapper)?.id).toMatch(/^flow-[a-z0-9]+-2$/)
    expect(lastCommand(wrapper)?.label).toBe('Update flow')
  })

  it('commits a node position only through a controlled model update', async () => {
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [createFlow()], initialTrigger: { kind: 'form.submit' } } })
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
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [createFlow()], initialTrigger: { kind: 'form.submit' } } })
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
    const wrapper = mount(FlowWorkspace, { props: { pageId: PAGE_ID, flows: [createFlow()], initialTrigger: { kind: 'form.submit' } } })
    await wrapper.get('[aria-label="Delete flow"]').trigger('click')
    const popconfirm = wrapper.findComponent({ name: 'ElPopconfirm' })
    expect(popconfirm.exists()).toBe(true)
    popconfirm.vm.$emit('confirm', new MouseEvent('click'))
    await wrapper.vm.$nextTick()
    expect(appliedOperation(wrapper)).toEqual({ type: 'flow.remove', pageId: PAGE_ID, flowId: 'existing' })
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
