// @vitest-environment happy-dom
import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type { EdgeRemoveChange, NodePositionChange } from '@vue-flow/core'
import { VueFlow } from '@vue-flow/core'
import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'
import FlowWorkspace from '../FlowWorkspace.vue'

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

describe('flowWorkspace', () => {
  it('uses an explicit locale outside the designer provider and reacts to replacements', async () => {
    const wrapper = mount(FlowWorkspace, {
      props: {
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
    const wrapper = mount(FlowWorkspace, { props: { flows: [] } })
    await wrapper.get('[data-testid="create-first-flow"]').trigger('click')
    const created = wrapper.emitted('update')?.at(-1)?.[0] as ConfigFormFlow[]
    await wrapper.setProps({ flows: created })

    const vueFlow = wrapper.getComponent(VueFlow)
    expect(vueFlow.props('applyDefault')).toBe(false)
    expect((vueFlow.props('nodes') as Array<{ id: string }>).map(node => node.id)).toEqual(['flow-1-trigger', 'flow-1-end'])
    expect(created[0]?.edges).toEqual([{ id: 'flow-1-next', source: 'flow-1-trigger', target: 'flow-1-end', condition: 'next' }])
  })

  it('keeps condition branches explicit when adding a condition node', async () => {
    const wrapper = mount(FlowWorkspace, { props: { flows: [createFlow()] } })
    await wrapper.get('[data-testid="add-condition"]').trigger('click')
    const updated = wrapper.emitted('update')?.at(-1)?.[0] as ConfigFormFlow[]
    const condition = updated[0]!.nodes.find(node => node.type === 'condition')!
    expect(updated[0]!.edges.filter(edge => edge.source === condition.id).map(edge => edge.condition).sort()).toEqual(['false', 'true'])
  })

  it('uses a registered field when selecting a field-change trigger', async () => {
    const wrapper = mount(FlowWorkspace, { props: { flows: [createFlow('field-flow')], fieldNames: ['email'] } })
    await wrapper.get('[aria-label="Flow trigger"]').setValue('field.change')
    const updated = wrapper.emitted('update')?.at(-1)?.[0] as ConfigFormFlow[]
    expect(updated[0]?.trigger).toEqual({ kind: 'field.change', field: 'email' })
  })

  it('keeps both condition branches when adding a node after a condition', async () => {
    const flow = createFlow('branch-flow')
    flow.nodes.splice(1, 0, { id: 'condition', type: 'condition', config: { condition: { kind: 'literal', value: true } } })
    flow.edges = [
      { id: 'trigger-condition', source: 'trigger', target: 'condition', condition: 'next' },
      { id: 'condition-true', source: 'condition', target: 'end', condition: 'true' },
      { id: 'condition-false', source: 'condition', target: 'end', condition: 'false' },
    ]
    const wrapper = mount(FlowWorkspace, { props: { flows: [flow] } })
    await wrapper.get('[data-testid="add-action"]').trigger('click')
    const updated = wrapper.emitted('update')?.at(-1)?.[0] as ConfigFormFlow[]
    const action = updated[0]!.nodes.find(node => node.type === 'action')!
    expect(updated[0]!.edges.filter(edge => edge.target === action.id).map(edge => edge.condition).sort()).toEqual(['false', 'true'])
    expect(updated[0]!.edges.filter(edge => edge.source === action.id).map(edge => edge.condition)).toEqual(['next'])
  })

  it('commits a node position only through a controlled model update', async () => {
    const wrapper = mount(FlowWorkspace, { props: { flows: [createFlow()] } })
    const change: NodePositionChange = {
      id: 'trigger',
      type: 'position',
      from: { x: 40, y: 80 },
      position: { x: 96.4, y: 144.7 },
      dragging: false,
    }
    wrapper.getComponent(VueFlow).vm.$emit('nodesChange', [change])
    await wrapper.vm.$nextTick()

    const updated = wrapper.emitted('update')?.at(-1)?.[0] as ConfigFormFlow[]
    expect(updated[0]!.nodes.find(node => node.id === 'trigger')?.position).toEqual({ x: 96, y: 145 })
  })

  it('rejects an edge deletion that would leave the trigger as a dead end', async () => {
    const wrapper = mount(FlowWorkspace, { props: { flows: [createFlow()] } })
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

    expect(wrapper.emitted('update')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('must connect to a next node')
  })
})
