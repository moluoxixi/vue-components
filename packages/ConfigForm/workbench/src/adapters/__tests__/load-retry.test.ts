import { describe, expect, it, vi } from 'vitest'
import { loadWorkbenchAdapter, loadWorkbenchRuntimeAdapter } from '../services/load'

const registry = vi.hoisted(() => ({ beforeCreate: vi.fn() }))
vi.mock('@moluoxixi/config-form-designer-element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@moluoxixi/config-form-designer-element-plus')>()
  return {
    ...actual,
    createElementPlusDesignerRegistry: (...args: Parameters<typeof actual.createElementPlusDesignerRegistry>) => {
      registry.beforeCreate()
      return actual.createElementPlusDesignerRegistry(...args)
    },
  }
})

describe('workbench adapter retry cache', () => {
  it.each([
    ['designer', loadWorkbenchAdapter],
    ['runtime', loadWorkbenchRuntimeAdapter],
  ] as const)('evicts a rejected %s adapter promise and retains the successful retry', async (_, load) => {
    registry.beforeCreate.mockImplementationOnce(() => {
      throw new Error('Adapter initialization failed')
    })
    const failed = load('element-plus')
    expect(load('element-plus')).toBe(failed)
    await expect(failed).rejects.toThrow('Adapter initialization failed')

    const retry = load('element-plus')
    expect(retry).not.toBe(failed)
    expect(load('element-plus')).toBe(retry)
    await expect(retry).resolves.toMatchObject({ runtimeResolver: expect.any(Object) })
    expect(load('element-plus')).toBe(retry)
  }, 30_000)
})
