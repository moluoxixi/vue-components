import type { Component } from 'vue'
import { docsSite } from '../docs-site'

export interface LocalSfcCompileOptions {
  id: string
  onError?: (error: unknown) => void
}

export interface LocalSfcCompileResult {
  component: Component
  dispose: () => void
}

export const supportedLocalSfcModules = Object.freeze([
  'vue',
  'element-plus',
  'element-plus/dist/index.css',
  docsSite.packageName,
  docsSite.packageStylesImport,
])

let compileVersion = 0

async function createModuleCache(): Promise<Record<string, unknown>> {
  const [VueRuntime, ElementPlusRuntime, Components] = await Promise.all([
    import('vue'),
    import('element-plus'),
    import('@docs-components'),
  ])
  const cache = Object.create(null) as Record<string, unknown>
  cache.vue = VueRuntime
  cache['element-plus'] = ElementPlusRuntime
  cache['element-plus/dist/index.css'] = {}
  cache[docsSite.packageName] = Components
  cache[docsSite.packageStylesImport] = {}
  return cache
}

function createVirtualPath(id: string): string {
  const safeId = id.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'demo'
  compileVersion += 1
  return `/__mx_docs_sfc__/${safeId}.v${compileVersion}.vue`
}

function formatLogArguments(args: unknown[]): string {
  return args.map(value => value instanceof Error ? value.message : String(value)).join(' ')
}

/** Compile one local demo SFC and return ownership of every injected style node. */
export async function compileLocalSfc(
  source: string,
  options: LocalSfcCompileOptions,
): Promise<LocalSfcCompileResult> {
  if (typeof document === 'undefined')
    throw new Error('SFC preview compilation is only available in the browser.')

  const virtualPath = createVirtualPath(options.id)
  const styleElements: HTMLStyleElement[] = []
  const dispose = (): void => {
    for (const element of styleElements.splice(0))
      element.remove()
  }

  try {
    const [{ loadModule }, moduleCache] = await Promise.all([
      import('vue3-sfc-loader'),
      createModuleCache(),
    ])
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
