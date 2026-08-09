// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElementPlusDocsSfcCompiler } from '../index'

const { loadModule } = vi.hoisted(() => ({ loadModule: vi.fn() }))

vi.mock('vue3-sfc-loader', () => ({ loadModule }))

interface LoaderOptions {
  addStyle: (css: string) => void
  getFile: (path: string) => Promise<{ getContentData: () => string }>
  log: (type: string, ...args: unknown[]) => void
  moduleCache: Record<string, unknown>
}

const supportedModules = {
  'element-plus': { ElButton: {} },
  'fixture-components': { CopyText: {} },
  'vue': { ref: () => undefined },
}
const compile = createElementPlusDocsSfcCompiler({
  createModuleCache: () => supportedModules,
})

describe('createElementPlusDocsSfcCompiler', () => {
  beforeEach(() => {
    loadModule.mockReset()
    document.head.querySelectorAll('[data-mx-docs-sfc]').forEach(element => element.remove())
  })

  it('uses one exact virtual entry and a fresh null-prototype module cache', async () => {
    const calls: Array<{ path: string, options: LoaderOptions }> = []
    loadModule.mockImplementation(async (path: string, options: LoaderOptions) => {
      calls.push({ path, options })
      return { name: 'Preview' }
    })

    await compile('<template>one</template>', { id: 'same demo' })
    await compile('<template>two</template>', { id: 'same demo' })

    expect(calls[0]!.path).toMatch(/^\/__mx_docs_sfc__\/same-demo\.v\d+\.vue$/)
    expect(calls[1]!.path).not.toBe(calls[0]!.path)
    expect(Object.getPrototypeOf(calls[0]!.options.moduleCache)).toBeNull()
    expect(calls[0]!.options.moduleCache).not.toBe(calls[1]!.options.moduleCache)
    expect(Object.keys(calls[0]!.options.moduleCache).sort()).toEqual(Object.keys(supportedModules).sort())
    await expect(calls[0]!.options.getFile(calls[0]!.path)).resolves.toMatchObject({})
    await expect(calls[0]!.options.getFile('./relative.vue')).rejects.toThrow('Unsupported SFC file request')
  })

  it('owns and idempotently disposes styles from a successful compile', async () => {
    loadModule.mockImplementation(async (_path: string, options: LoaderOptions) => {
      options.addStyle('.preview { color: red; }')
      return { name: 'Preview' }
    })

    const result = await compile('<template />', { id: 'styled' })
    expect(document.head.querySelectorAll('[data-mx-docs-sfc]')).toHaveLength(1)
    result.dispose()
    result.dispose()
    expect(document.head.querySelectorAll('[data-mx-docs-sfc]')).toHaveLength(0)
  })

  it('removes partial styles when compilation fails', async () => {
    loadModule.mockImplementation(async (_path: string, options: LoaderOptions) => {
      options.addStyle('.partial { color: red; }')
      throw new Error('compile failed')
    })

    await expect(compile('<template>', { id: 'broken' })).rejects.toThrow('compile failed')
    expect(document.head.querySelectorAll('[data-mx-docs-sfc]')).toHaveLength(0)
  })

  it('forwards loader diagnostics to the caller', async () => {
    const onError = vi.fn()
    loadModule.mockImplementation(async (_path: string, options: LoaderOptions) => {
      options.log('error', new Error('bad template'), 42)
      return { name: 'Preview' }
    })

    await compile('<template />', { id: 'diagnostic', onError })
    expect(onError).toHaveBeenCalledWith('bad template 42')
  })
})
