import type {
  ConfigFormDataSourceDefinition,
  ConfigFormFlow,
  ConfigFormFlowAction,
  ConfigFormFlowHttpRequestOutput,
  ConfigFormJsonValue,
  ConfigFormValueInput,
} from '@moluoxixi/config-form-core'
import type { VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import type { ConfigFormPageRuntimePlan } from '../../runtime'
import type { ConfigFormRendererComponentProps, ConfigFormRendererExpose } from '../types'
import { analyzeConfigFormFlow } from '@moluoxixi/config-form-core'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { ConfigForm } from '../../components'
import { ConfigFormRenderer } from '../index'

export const Control = defineComponent({
  props: ['modelValue', 'options', 'loading', 'optionState'],
  emits: ['run', 'update:modelValue'],
  setup: (props, { emit }) => () => h('button', { type: 'button', onClick: () => emit('run') }, JSON.stringify(props.options ?? [])),
})
export const fieldRef = (nodeId: string, scope: 'current' | 'parent' | 'root' = 'current'): ConfigFormValueInput => ({ $ref: { kind: 'field', nodeId, scope } })
export const variableRef = (variableId: string): ConfigFormValueInput => ({ $ref: { kind: 'variable', variableId } })
export const outputRef = (stepId: string, path: string[] = []): ConfigFormValueInput => ({ $ref: { kind: 'output', stepId, path } })
export const response = (data: unknown, ok = true): ConfigFormFlowHttpRequestOutput => ({ data, ok, status: ok ? 200 : 500 })
export function deferred<T = ConfigFormFlowHttpRequestOutput>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
export function source(overrides: Partial<ConfigFormDataSourceDefinition> = {}): ConfigFormDataSourceDefinition {
  return { id: 'choices', name: 'Choices', request: { url: '/choices' }, cacheTtlMs: 60_000, ...overrides }
}
export function flow(
  steps: Array<{ ref: string, input?: ConfigFormValueInput }>,
  trigger: ConfigFormFlow['trigger'] = { kind: 'component.event', nodeId: 'choice', event: 'run' },
  terminal: 'success' | 'failure' = 'success',
): ConfigFormPageRuntimePlan['flows'][number] {
  const nodes: ConfigFormFlow['nodes'] = [
    { id: 'start', type: 'trigger' },
    ...steps.map((step, index) => ({ id: `step${index}`, type: 'action' as const, ref: step.ref, config: { input: (step.input ?? null) as ConfigFormJsonValue } })),
    { id: 'end', type: terminal },
  ]
  const result = analyzeConfigFormFlow({
    id: `flow-${trigger.kind}`,
    name: 'Data flow',
    version: 1,
    trigger,
    nodes,
    edges: nodes.slice(1).map((node, index) => ({ id: `edge${index}`, source: nodes[index]!.id, target: node.id })),
  })
  if (!result.success)
    throw new Error(JSON.stringify(result.diagnostics))
  return result.plan
}
export function plan(overrides: Partial<ConfigFormPageRuntimePlan> = {}): ConfigFormPageRuntimePlan {
  return {
    flows: [],
    optionBindings: [],
    runtime: { variables: [], dataSources: [] },
    valueSchema: { valueScopes: [], scopedFields: ['country', 'second', 'choice', 'result'].map(nodeId => ({ nodeId, field: nodeId })) },
    ...overrides,
  }
}
export function binding(nodeId = 'choice', params?: Record<string, ConfigFormValueInput>) {
  return { nodeId, source: { kind: 'dataSource' as const, dataSourceId: 'choices', ...(params ? { params } : {}) } }
}
const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.exists() && wrapper.unmount())
})
export async function fixture(settings: {
  plan?: ConfigFormPageRuntimePlan
  values?: Record<string, unknown>
  props?: Partial<ConfigFormRendererComponentProps>
  actions?: Record<string, ConfigFormFlowAction['execute']>
  configForm?: boolean
} = {}) {
  const values = shallowRef(settings.values ?? { country: 'a', second: 'b', choice: null, result: 0 })
  const wrapper = mount((settings.configForm ? ConfigForm : ConfigFormRenderer) as Component, { props: {
    fields: ['country', 'second', 'choice', 'result'].map(id => ({ id, field: id, component: Control })),
    model: createConfigFormModel(values),
    plan: settings.plan ?? plan(),
    flowActions: { get: (ref: string) => settings.actions?.[ref]
      ? {
          descriptor: { ref, title: ref, category: 'test', parameters: [], outputs: [], capabilities: [] },
          execute: settings.actions[ref],
        }
      : undefined },
    ...settings.props,
  } })
  wrappers.push(wrapper)
  await flushPromises()
  const api = wrapper.vm as unknown as ConfigFormRendererExpose
  const run = async () => {
    await wrapper.get('[data-field="choice"]').findComponent(Control).trigger('click')
    await flushPromises()
  }
  return { api, run, values, wrapper }
}
