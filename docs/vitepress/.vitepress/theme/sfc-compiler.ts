import type { Component } from 'vue'
import * as Components from '@docs-components'
import * as ElementPlusRuntime from 'element-plus'
import * as VueRuntime from 'vue'
import { docsSite } from '../docs-site'

export interface LocalSfcCompileOptions {
  id: string
  onError?: (error: unknown) => void
}

export interface LocalSfcCompileResult {
  component: Component
  dispose: () => void
}

type RuntimeModuleFactory = () => unknown

const runtimeModuleFactories: Readonly<Record<string, RuntimeModuleFactory>> = Object.freeze({
  'vue': () => VueRuntime,
  'element-plus': () => ElementPlusRuntime,
  'element-plus/dist/index.css': () => ({}),
  [docsSite.packageName]: () => Components,
  [docsSite.packageStylesImport]: () => ({}),
})

export const supportedLocalSfcModules = Object.freeze(Object.keys(runtimeModuleFactories))

let compileVersion = 0

function createModuleCache(): Record<string, unknown> {
  const cache = Object.create(null) as Record<string, unknown>
  for (const [name, createRuntime] of Object.entries(runtimeModuleFactories))
    cache[name] = createRuntime()
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
    const { loadModule } = await import('vue3-sfc-loader')
    const component = await loadModule(virtualPath, {
      moduleCache: createModuleCache(),
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
