import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { RequestCascader, RequestSelectV2, RequestTreeSelect } from '../index'

interface Option {
  label: string
  value: string
  children?: Option[]
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

async function waitFor(assertion: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now()
  while (!assertion()) {
    if (Date.now() - start > timeout)
      throw new Error('waitFor: timed out before condition was met')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

function serialize(value: unknown): string {
  return JSON.stringify(value)
}

const ElSelectV2Stub = defineComponent({
  name: 'ElSelectV2',
  props: {
    loading: Boolean,
    modelValue: { type: null, default: undefined },
    options: { type: Array, default: () => [] },
  },
  emits: ['change', 'update:modelValue'],
  setup(props, { emit }) {
    return () => h('button', {
      'data-loading': String(props.loading),
      'data-model-value': String(props.modelValue ?? ''),
      'data-options': serialize(props.options),
      'data-testid': 'select-v2-stub',
      'onClick': () => {
        emit('update:modelValue', 'selected')
        emit('change', 'selected')
      },
      'type': 'button',
    }, 'select')
  },
})

const ElCascaderStub = defineComponent({
  name: 'ElCascader',
  props: {
    loading: Boolean,
    modelValue: { type: null, default: undefined },
    options: { type: Array, default: () => [] },
  },
  emits: ['change', 'update:modelValue'],
  setup(props, { emit }) {
    return () => h('button', {
      'data-loading': String(props.loading),
      'data-model-value': serialize(props.modelValue),
      'data-options': serialize(props.options),
      'data-testid': 'cascader-stub',
      'onClick': () => {
        emit('update:modelValue', ['parent', 'child'])
        emit('change', ['parent', 'child'])
      },
      'type': 'button',
    }, 'cascader')
  },
})

const ElTreeSelectStub = defineComponent({
  name: 'ElTreeSelect',
  props: {
    data: { type: Array, default: () => [] },
    loading: Boolean,
    modelValue: { type: null, default: undefined },
  },
  emits: ['change', 'update:modelValue'],
  setup(props, { emit }) {
    return () => h('button', {
      'data-data': serialize(props.data),
      'data-loading': String(props.loading),
      'data-model-value': String(props.modelValue ?? ''),
      'data-testid': 'tree-select-stub',
      'onClick': () => {
        emit('update:modelValue', 'tree-child')
        emit('change', 'tree-child')
      },
      'type': 'button',
    }, 'tree')
  },
})

function mountWithQuery(component: any, props: Record<string, unknown>, stubs: Record<string, any>) {
  return mount(component, {
    props,
    global: {
      plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
      stubs,
    },
  })
}

describe('request option components', () => {
  it('requestSelectV2 binds query options to ElSelectV2 and writes model value back', async () => {
    const query = vi.fn(async (params: Record<string, unknown>): Promise<Option[]> => [
      { label: `Role ${String(params.keyword ?? '')}`, value: String(params.keyword ?? '') },
    ])
    const loaded = vi.fn()
    const wrapper = mountWithQuery(RequestSelectV2, {
      modelValue: '',
      query,
      params: { keyword: 'admin' },
      onLoaded: loaded,
    }, {
      ElSelectV2: ElSelectV2Stub,
    })

    await waitFor(() => wrapper.get('[data-testid="select-v2-stub"]').attributes('data-options')?.includes('admin') === true)

    expect(query).toHaveBeenCalledWith({ keyword: 'admin' })
    expect(JSON.parse(wrapper.get('[data-testid="select-v2-stub"]').attributes('data-options')!)).toEqual([{ label: 'Role admin', value: 'admin' }])
    expect(loaded).toHaveBeenCalledWith([{ label: 'Role admin', value: 'admin' }])

    await wrapper.get('[data-testid="select-v2-stub"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['selected'])
  })

  it('requestSelectV2 updates cache key when params change and exposes refetch', async () => {
    const query = vi.fn(async (params: Record<string, unknown>): Promise<Option[]> => [
      { label: `Role ${String(params.keyword ?? '')}`, value: String(params.keyword ?? '') },
    ])
    const wrapper = mountWithQuery(RequestSelectV2, {
      modelValue: '',
      query,
      params: { keyword: 'admin' },
    }, {
      ElSelectV2: ElSelectV2Stub,
    })

    await waitFor(() => wrapper.get('[data-testid="select-v2-stub"]').attributes('data-options')?.includes('admin') === true)

    await wrapper.setProps({ params: { keyword: 'guest' } })
    await waitFor(() => wrapper.get('[data-testid="select-v2-stub"]').attributes('data-options')?.includes('guest') === true)

    await (wrapper.vm as unknown as { refetch: () => Promise<unknown> }).refetch()
    await waitFor(() => query.mock.calls.length >= 3)

    expect(query.mock.calls.map(call => call[0])).toContainEqual({ keyword: 'admin' })
    expect(query.mock.calls.map(call => call[0])).toContainEqual({ keyword: 'guest' })
  })

  it('requestCascader binds query options to ElCascader', async () => {
    const options: Option[] = [{ label: 'Parent', value: 'parent', children: [{ label: 'Child', value: 'child' }] }]
    const query = vi.fn(async (): Promise<Option[]> => options)
    const wrapper = mountWithQuery(RequestCascader, {
      modelValue: [],
      query,
      params: { area: 'south' },
    }, {
      ElCascader: ElCascaderStub,
    })

    await waitFor(() => wrapper.get('[data-testid="cascader-stub"]').attributes('data-options')?.includes('Parent') === true)

    expect(JSON.parse(wrapper.get('[data-testid="cascader-stub"]').attributes('data-options')!)).toEqual(options)

    await wrapper.get('[data-testid="cascader-stub"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([['parent', 'child']])
  })

  it('requestTreeSelect binds query options to ElTreeSelect data', async () => {
    const options: Option[] = [{ label: 'Tree Parent', value: 'tree-parent', children: [{ label: 'Tree Child', value: 'tree-child' }] }]
    const query = vi.fn(async (): Promise<Option[]> => options)
    const wrapper = mountWithQuery(RequestTreeSelect, {
      modelValue: '',
      query,
      params: { root: 'tree' },
    }, {
      ElTreeSelect: ElTreeSelectStub,
    })

    await waitFor(() => wrapper.get('[data-testid="tree-select-stub"]').attributes('data-data')?.includes('Tree Parent') === true)

    expect(JSON.parse(wrapper.get('[data-testid="tree-select-stub"]').attributes('data-data')!)).toEqual(options)

    await wrapper.get('[data-testid="tree-select-stub"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['tree-child'])
  })

  it('emits error when option request fails', async () => {
    const failure = new Error('options failed')
    const error = vi.fn()
    const query = vi.fn(async (): Promise<Option[]> => {
      throw failure
    })
    const wrapper = mountWithQuery(RequestSelectV2, {
      modelValue: '',
      query,
      params: {},
      onError: error,
    }, {
      ElSelectV2: ElSelectV2Stub,
    })

    await waitFor(() => error.mock.calls.length === 1)

    expect(error).toHaveBeenCalledWith(failure)
    expect(JSON.parse(wrapper.get('[data-testid="select-v2-stub"]').attributes('data-options')!)).toEqual([])
  })
})
