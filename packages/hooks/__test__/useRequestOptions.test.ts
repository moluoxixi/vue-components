import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useRequestOptions } from '../src/composables'
import { createTestQueryClient, waitFor, withSetup } from './test-utils'

interface Option {
  label: string
  value: string
}

describe('useRequestOptions', () => {
  it('uses params as part of the query key and returns option arrays', async () => {
    const params = ref({ keyword: 'a' })
    const query = vi.fn(async (input: { keyword: string }): Promise<Option[]> => [
      { label: input.keyword.toUpperCase(), value: input.keyword },
    ])
    const queryClient = createTestQueryClient()
    const { result, unmount } = withSetup(() => useRequestOptions<Option, { keyword: string }>({
      queryKey: 'request-select',
      query,
      params,
    }), queryClient)

    await waitFor(() => result.options.value.length === 1)
    expect(result.options.value).toEqual([{ label: 'A', value: 'a' }])
    expect(queryClient.getQueryData(['request-select', { keyword: 'a' }])).toEqual([{ label: 'A', value: 'a' }])

    params.value = { keyword: 'b' }
    await waitFor(() => result.options.value[0]?.value === 'b')

    expect(result.options.value).toEqual([{ label: 'B', value: 'b' }])
    expect(query).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData(['request-select', { keyword: 'b' }])).toEqual([{ label: 'B', value: 'b' }])

    unmount()
  })

  it('supports enabled=false and manual refetch', async () => {
    const query = vi.fn(async (): Promise<Option[]> => [{ label: 'Role', value: 'role' }])
    const { result, unmount } = withSetup(() => useRequestOptions<Option>({
      queryKey: 'disabled-options',
      query,
      params: {},
      enabled: false,
    }))

    expect(result.options.value).toEqual([])
    expect(query).not.toHaveBeenCalled()

    await result.refetch()
    await waitFor(() => result.options.value.length === 1)

    expect(result.options.value).toEqual([{ label: 'Role', value: 'role' }])
    expect(query).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('exposes errors without swallowing request failures', async () => {
    const failure = new Error('load failed')
    const enabled = computed(() => true)
    const query = vi.fn(async (): Promise<Option[]> => {
      throw failure
    })
    const { result, unmount } = withSetup(() => useRequestOptions<Option>({
      queryKey: 'broken-options',
      query,
      params: {},
      enabled,
    }))

    await waitFor(() => result.isError.value)

    expect(result.error.value).toBe(failure)
    expect(result.options.value).toEqual([])

    unmount()
  })
})
