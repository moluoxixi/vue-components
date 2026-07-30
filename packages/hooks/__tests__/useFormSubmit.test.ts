import { QueryClient } from '@tanstack/vue-query'
import { describe, expect, it, vi } from 'vitest'
import { useFormSubmit } from '../src/composables'
import { waitFor, withSetup } from './test-utils'

interface FormValues { name: string }

describe('useFormSubmit', () => {
  it('不传 id 时按新增模式提交，payload.mode 为 create', async () => {
    const submit = vi.fn(async (): Promise<{ ok: boolean }> => ({ ok: true }))
    const { result, unmount } = withSetup(() => useFormSubmit<FormValues, { ok: boolean }>({ submit }))

    const res = await result.submit({ name: 'a' })
    expect(res).toEqual({ ok: true })
    expect(submit).toHaveBeenCalledWith({ mode: 'create', id: undefined, values: { name: 'a' } })
    expect(result.mode.value).toBe('create')
    unmount()
  })

  it('传入 id 时按编辑模式提交，payload.mode 为 update', async () => {
    const submit = vi.fn(async (): Promise<{ ok: boolean }> => ({ ok: true }))
    const { result, unmount } = withSetup(() => useFormSubmit<FormValues, { ok: boolean }>({ submit }))

    await result.submit({ name: 'b' }, 10)
    expect(submit).toHaveBeenCalledWith({ mode: 'update', id: 10, values: { name: 'b' } })
    expect(result.mode.value).toBe('update')
    unmount()
  })

  it('提交成功后调用 onSuccess 并使 invalidateKeys 指向的查询失效', async () => {
    const submit = vi.fn(async (): Promise<number> => 1)
    const onSuccess = vi.fn()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result, unmount } = withSetup(
      () => useFormSubmit<FormValues, number>({ submit, invalidateKeys: ['rows', ['detail', 1]], onSuccess }),
      queryClient,
    )

    await result.submit({ name: 'c' })
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rows'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['detail', 1] })
    unmount()
  })

  it('提交失败时抛出错误、进入错误态并回调 onError', async () => {
    const submit = vi.fn(async (): Promise<number> => {
      throw new Error('fail')
    })
    const onError = vi.fn()
    const { result, unmount } = withSetup(() => useFormSubmit<FormValues, number>({ submit, onError }))

    await expect(result.submit({ name: 'd' })).rejects.toThrow('fail')
    await waitFor(() => result.isError.value)
    expect(result.error.value?.message).toBe('fail')
    expect(onError).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('reset 清空错误态，isError 回到 false', async () => {
    const submit = vi.fn(async (): Promise<number> => {
      throw new Error('fail')
    })
    const { result, unmount } = withSetup(() => useFormSubmit<FormValues, number>({ submit }))

    await expect(result.submit({ name: 'e' })).rejects.toThrow('fail')
    await waitFor(() => result.isError.value)
    expect(result.isError.value).toBe(true)

    result.reset()
    await waitFor(() => !result.isError.value)
    expect(result.isError.value).toBe(false)
    expect(result.error.value).toBeNull()
    unmount()
  })
})
