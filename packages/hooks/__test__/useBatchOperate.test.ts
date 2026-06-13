import { describe, expect, it, vi } from 'vitest'
import { useBatchOperate } from '../src/composables'
import { waitFor, withSetup } from './test-utils'

describe('useBatchOperate', () => {
  it('toggle 切换选中态，selectedCount/hasSelection 同步更新', () => {
    const operate = vi.fn(async () => ({ affected: 0 }))
    const { result, unmount } = withSetup(() => useBatchOperate<number>({ operate }))

    expect(result.hasSelection.value).toBe(false)
    result.toggle(1)
    result.toggle(2)
    expect(result.selectedKeys.value).toEqual([1, 2])
    expect(result.selectedCount.value).toBe(2)
    expect(result.isSelected(1)).toBe(true)

    result.toggle(1)
    expect(result.selectedKeys.value).toEqual([2])
    expect(result.isSelected(1)).toBe(false)
    unmount()
  })

  it('setSelection 去重替换，clearSelection 清空', () => {
    const operate = vi.fn(async () => ({ affected: 0 }))
    const { result, unmount } = withSetup(() => useBatchOperate<number>({ operate }))

    result.setSelection([1, 1, 2, 3, 3])
    expect(result.selectedKeys.value).toEqual([1, 2, 3])
    result.clearSelection()
    expect(result.selectedKeys.value).toEqual([])
    expect(result.hasSelection.value).toBe(false)
    unmount()
  })

  it('execute 携带选中集合与附加参数调用 operate', async () => {
    const operate = vi.fn(async (): Promise<{ affected: number }> => ({ affected: 2 }))
    const { result, unmount } = withSetup(() => useBatchOperate<number, { affected: number }, { status: string }>({ operate }))

    result.setSelection([10, 20])
    const res = await result.execute({ status: 'archived' })
    expect(res).toEqual({ affected: 2 })
    expect(operate).toHaveBeenCalledWith({ keys: [10, 20], payload: { status: 'archived' } })
    unmount()
  })

  it('成功后默认清空选中并使 invalidateKeys 失效', async () => {
    const operate = vi.fn(async (): Promise<number> => 1)
    const { QueryClient } = await import('@tanstack/vue-query')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result, unmount } = withSetup(
      () => useBatchOperate<number, number>({ operate, invalidateKeys: ['rows'] }),
      queryClient,
    )

    result.setSelection([1, 2])
    await result.execute()
    expect(result.selectedKeys.value).toEqual([])
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rows'] })
    unmount()
  })

  it('clearSelectionOnSuccess 为 false 时保留选中集合', async () => {
    const operate = vi.fn(async (): Promise<number> => 1)
    const { result, unmount } = withSetup(() => useBatchOperate<number, number>({ operate, clearSelectionOnSuccess: false }))

    result.setSelection([5, 6])
    await result.execute()
    expect(result.selectedKeys.value).toEqual([5, 6])
    unmount()
  })

  it('操作失败时进入错误态并保留选中集合', async () => {
    const operate = vi.fn(async (): Promise<number> => {
      throw new Error('batch-fail')
    })
    const { result, unmount } = withSetup(() => useBatchOperate<number, number>({ operate }))

    result.setSelection([7])
    await expect(result.execute()).rejects.toThrow('batch-fail')
    await waitFor(() => result.isError.value)
    expect(result.error.value?.message).toBe('batch-fail')
    expect(result.selectedKeys.value).toEqual([7])
    unmount()
  })

  it('空选中集合时 execute 直接拒绝且不调用 operate', async () => {
    const operate = vi.fn(async (): Promise<number> => 1)
    const { result, unmount } = withSetup(() => useBatchOperate<number, number>({ operate }))

    await expect(result.execute()).rejects.toThrow('no items selected')
    expect(operate).not.toHaveBeenCalled()
    unmount()
  })
})
