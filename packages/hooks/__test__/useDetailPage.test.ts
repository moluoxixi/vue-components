import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useDetailPage } from '../src/composables'
import { waitFor, withSetup } from './test-utils'

interface Detail { id: number, title: string }

describe('useDetailPage', () => {
  it('主键存在时拉取详情并暴露 detail', async () => {
    const fetcher = vi.fn(async (id: number): Promise<Detail> => ({ id, title: `t-${id}` }))
    const { result, unmount } = withSetup(() => useDetailPage<Detail>({ queryKey: 'detail', fetcher, id: 7 }))

    await waitFor(() => !result.isLoading.value)
    expect(fetcher).toHaveBeenCalledWith(7)
    expect(result.detail.value).toEqual({ id: 7, title: 't-7' })
    expect(result.isEnabled.value).toBe(true)
    unmount()
  })

  it('主键为 null 时禁用查询，不发起请求', async () => {
    const fetcher = vi.fn(async (id: number): Promise<Detail> => ({ id, title: `t-${id}` }))
    const { result, unmount } = withSetup(() => useDetailPage<Detail>({ queryKey: 'detail', fetcher, id: null }))

    await new Promise(r => setTimeout(r, 50))
    expect(fetcher).not.toHaveBeenCalled()
    expect(result.isEnabled.value).toBe(false)
    expect(result.detail.value).toBeUndefined()
    unmount()
  })

  it('主键从空变为有值时自动启用并拉取', async () => {
    const fetcher = vi.fn(async (id: number): Promise<Detail> => ({ id, title: `t-${id}` }))
    const id = ref<number | null>(null)
    const { result, unmount } = withSetup(() => useDetailPage<Detail>({ queryKey: 'detail', fetcher, id }))

    await new Promise(r => setTimeout(r, 30))
    expect(fetcher).not.toHaveBeenCalled()

    id.value = 99
    await waitFor(() => result.detail.value !== undefined)
    expect(fetcher).toHaveBeenCalledWith(99)
    expect(result.detail.value).toEqual({ id: 99, title: 't-99' })
    unmount()
  })

  it('enabled 为 false 时即使有主键也不查询', async () => {
    const fetcher = vi.fn(async (id: number): Promise<Detail> => ({ id, title: `t-${id}` }))
    const { result, unmount } = withSetup(() => useDetailPage<Detail>({ queryKey: 'detail', fetcher, id: 1, enabled: false }))

    await new Promise(r => setTimeout(r, 50))
    expect(fetcher).not.toHaveBeenCalled()
    expect(result.isEnabled.value).toBe(false)
    unmount()
  })

  it('错误态：fetcher 抛错时进入 isError', async () => {
    const fetcher = vi.fn(async (): Promise<Detail> => {
      throw new Error('boom')
    })
    const { result, unmount } = withSetup(() => useDetailPage<Detail>({ queryKey: 'detail', fetcher, id: 5 }))

    await waitFor(() => result.isError.value)
    expect(result.error.value).toBeInstanceOf(Error)
    expect(result.error.value?.message).toBe('boom')
    unmount()
  })
})
