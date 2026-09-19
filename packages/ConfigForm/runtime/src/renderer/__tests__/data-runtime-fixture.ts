import type {
  ConfigFormDataSourceDefinition,
  ConfigFormDataSourceHttpRequestOutput,
  ConfigFormValueInput,
} from '@moluoxixi/config-form-core'
import type { VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import type { ConfigFormSurfaceRuntimePlan } from '../../runtime'
import type { ConfigFormRendererComponentProps, ConfigFormRendererExpose } from '../types'
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
export const response = (data: unknown, ok = true): ConfigFormDataSourceHttpRequestOutput => ({ data, ok, status: ok ? 200 : 500 })
export function deferred<T = ConfigFormDataSourceHttpRequestOutput>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
export function source(overrides: Partial<ConfigFormDataSourceDefinition> = {}): ConfigFormDataSourceDefinition {
  return { id: 'choices', name: 'Choices', request: { url: '/choices' }, cacheTtlMs: 60_000, ...overrides }
}
export function plan(overrides: Partial<ConfigFormSurfaceRuntimePlan> = {}): ConfigFormSurfaceRuntimePlan {
  return {
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
  plan?: ConfigFormSurfaceRuntimePlan
  values?: Record<string, unknown>
  props?: Partial<ConfigFormRendererComponentProps>
  configForm?: boolean
} = {}) {
  const values = shallowRef(settings.values ?? { country: 'a', second: 'b', choice: null, result: 0 })
  const wrapper = mount((settings.configForm ? ConfigForm : ConfigFormRenderer) as Component, { props: {
    fields: ['country', 'second', 'choice', 'result'].map(id => ({ id, field: id, component: Control })),
    model: createConfigFormModel(values),
    plan: settings.plan ?? plan(),
    ...settings.props,
  } })
  wrappers.push(wrapper)
  await flushPromises()
  const api = wrapper.vm as unknown as ConfigFormRendererExpose
  return { api, values, wrapper }
}
