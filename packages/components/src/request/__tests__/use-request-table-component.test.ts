import type { UseRequestTableComponentOptions } from '../composables/use-request-table-component'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import { useRequestTableComponent } from '../composables/use-request-table-component'

interface Row {
  id: number
  label: string
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

function mountBridge(options: UseRequestTableComponentOptions<Row>) {
  let result!: ReturnType<typeof useRequestTableComponent<Row>>
  const wrapper = mount(defineComponent({
    setup() {
      result = useRequestTableComponent(options)
      return () => h('div')
    },
  }), {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
    },
  })
  return {
    get result() {
      return result
    },
    wrapper,
  }
}

describe('useRequestTableComponent', () => {
  it('maps request results, callbacks, params resets, and pagination models', async () => {
    const currentPage = ref(2)
    const pageSize = ref(20)
    const props = reactive({
      cacheKey: ['bridge', 'rows'],
      params: { keyword: 'first' },
      query: vi.fn(async (params: Record<string, unknown> & { currentPage: number, pageSize: number }) => ({
        data: [{ id: params.currentPage, label: `${params.keyword}-${params.pageSize}` }],
        total: 40,
      })),
    })
    const onLoaded = vi.fn()
    const onError = vi.fn()
    const onPageChange = vi.fn()
    const bridge = mountBridge({
      props,
      models: { currentPage, pageSize },
      fallbackCacheKey: 'fallback-rows',
      onLoaded,
      onError,
      onPageChange,
    })

    await waitFor(() => bridge.result.tableData.value[0]?.id === 2)
    expect(props.query).toHaveBeenCalledWith({ keyword: 'first', currentPage: 2, pageSize: 20 })
    expect(onLoaded).toHaveBeenCalledWith({
      data: [{ id: 2, label: 'first-20' }],
      total: 40,
    })

    bridge.result.handleCurrentPageUpdate(3)
    await waitFor(() => bridge.result.tableData.value[0]?.id === 3)
    expect(onPageChange).toHaveBeenLastCalledWith({ currentPage: 3, pageSize: 20 })

    bridge.result.handlePageSizeUpdate(50)
    await waitFor(() => bridge.result.tableData.value[0]?.label === 'first-50')
    expect(currentPage.value).toBe(1)
    expect(pageSize.value).toBe(50)
    expect(onPageChange).toHaveBeenLastCalledWith({ currentPage: 1, pageSize: 50 })

    props.params = { keyword: 'next' }
    await waitFor(() => bridge.result.tableData.value[0]?.label === 'next-50')
    expect(currentPage.value).toBe(1)
    expect(onError).not.toHaveBeenCalled()
    bridge.wrapper.unmount()
  })

  it('forwards request errors', async () => {
    const failure = new Error('request failed')
    const onError = vi.fn()
    const bridge = mountBridge({
      props: { query: vi.fn().mockRejectedValue(failure) },
      models: { currentPage: ref(1), pageSize: ref(10) },
      fallbackCacheKey: 'failed-rows',
      onLoaded: vi.fn(),
      onError,
      onPageChange: vi.fn(),
    })

    await waitFor(() => bridge.result.requestTable?.isError.value === true)
    expect(onError).toHaveBeenCalledWith(failure)
    bridge.wrapper.unmount()
  })

  it('preserves the current page when params change and reset is disabled', async () => {
    const currentPage = ref(4)
    const props = reactive({
      params: { keyword: 'first' },
      query: vi.fn(async (params: Record<string, unknown> & { currentPage: number }) => ({
        data: [{ id: params.currentPage, label: String(params.keyword) }],
        total: 80,
      })),
      resetPageOnParamsChange: false,
    })
    const bridge = mountBridge({
      props,
      models: { currentPage, pageSize: ref(20) },
      fallbackCacheKey: 'preserved-page-rows',
      onLoaded: vi.fn(),
      onError: vi.fn(),
      onPageChange: vi.fn(),
    })

    await waitFor(() => bridge.result.tableData.value[0]?.label === 'first')
    props.params = { keyword: 'next' }
    await waitFor(() => bridge.result.tableData.value[0]?.label === 'next')

    expect(currentPage.value).toBe(4)
    expect(props.query).toHaveBeenLastCalledWith({ keyword: 'next', currentPage: 4, pageSize: 20 })
    bridge.wrapper.unmount()
  })

  it('uses static data and updates local pagination without a query', () => {
    const currentPage = ref(4)
    const pageSize = ref(20)
    const onPageChange = vi.fn()
    const rows = [{ id: 1, label: 'static' }]
    const bridge = mountBridge({
      props: { data: rows },
      models: { currentPage, pageSize },
      fallbackCacheKey: 'static-rows',
      onLoaded: vi.fn(),
      onError: vi.fn(),
      onPageChange,
    })

    expect(bridge.result.requestTable).toBeNull()
    expect(bridge.result.tableData.value).toBe(rows)
    expect(bridge.result.requestLoading.value).toBe(false)

    bridge.result.handleCurrentPageUpdate(6)
    expect(currentPage.value).toBe(6)
    expect(onPageChange).toHaveBeenLastCalledWith({ currentPage: 6, pageSize: 20 })

    bridge.result.handlePageSizeUpdate(50)
    expect(currentPage.value).toBe(1)
    expect(pageSize.value).toBe(50)
    expect(onPageChange).toHaveBeenLastCalledWith({ currentPage: 1, pageSize: 50 })
    bridge.wrapper.unmount()
  })
})
