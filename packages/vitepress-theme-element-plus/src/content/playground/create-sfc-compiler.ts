import type { Component } from 'vue'
import type { ElementPlusDocsSfcCompiler, ElementPlusDocsSfcCompilerOptions } from './types'

let compileVersion = 0

function createVirtualPath(id: string, prefix: string): string {
  const safeId = id.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'demo'
  compileVersion += 1
  return `${prefix}/${safeId}.v${compileVersion}.vue`
}

function formatLogArguments(args: unknown[]): string {
  return args.map(value => value instanceof Error ? value.message : String(value)).join(' ')
}

export function createElementPlusDocsSfcCompiler(
  compilerOptions: ElementPlusDocsSfcCompilerOptions,
): ElementPlusDocsSfcCompiler {
  const virtualPathPrefix = compilerOptions.virtualPathPrefix ?? '/__mx_docs_sfc__'

  return async (source, options) => {
    if (typeof document === 'undefined')
      throw new Error('SFC preview compilation is only available in the browser.')

    const virtualPath = createVirtualPath(options.id, virtualPathPrefix)
    const styleElements: HTMLStyleElement[] = []
    const dispose = (): void => {
      for (const element of styleElements.splice(0))
        element.remove()
    }

    try {
      const [{ loadModule }, suppliedModules] = await Promise.all([
        import('vue3-sfc-loader'),
        compilerOptions.createModuleCache(),
      ])
      const moduleCache = Object.assign(Object.create(null) as Record<string, unknown>, suppliedModules)
      const component = await loadModule(virtualPath, {
        moduleCache,
        getFile: async (requestedPath: string) => {
          if (requestedPath !== virtualPath)
            throw new Error(`Unsupported SFC file request: ${requestedPath}`)

          return {
            getContentData: () => source,
            type: '.vue' as const,
          }
        },
        addStyle: (css: string) => {
          const element = document.createElement('style')
          element.dataset.mxDocsSfc = virtualPath
          element.textContent = css
          document.head.appendChild(element)
          styleElements.push(element)
        },
        log: (type: string, ...args: unknown[]) => {
          if (type === 'error')
            options.onError?.(formatLogArguments(args))
        },
      } as never) as unknown as Component

      return { component, dispose }
    }
    catch (error) {
      dispose()
      throw error
    }
  }
}
