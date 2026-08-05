export interface StableChunkOptions {
  antd?: boolean
  configForm?: boolean
  element?: boolean
  query?: boolean
  richText?: boolean
  sfcRuntime?: boolean
}

interface ManualChunksOutput {
  manualChunks?: ManualChunksFunction | Record<string, string[]>
}

interface ResolvedViteConfigLike {
  build: {
    rollupOptions: {
      output?: ManualChunksOutput | ManualChunksOutput[]
    }
    ssr?: boolean | string
  }
}

type ManualChunksFunction = (id: string, api: unknown) => string | undefined

const defaultOptions: Required<StableChunkOptions> = {
  antd: true,
  configForm: true,
  element: true,
  query: true,
  richText: true,
  sfcRuntime: true,
}

function includesPackage(path: string, packageName: string): boolean {
  return path.includes(`/node_modules/${packageName}/`)
}

export function getStableChunkName(
  id: string,
  options: StableChunkOptions = {},
): string | undefined {
  const enabled = { ...defaultOptions, ...options }
  const path = id.replaceAll('\\', '/')

  if (
    enabled.sfcRuntime
    && (includesPackage(path, 'vue3-sfc-loader') || includesPackage(path, '@vue/compiler-sfc'))
  ) {
    return 'vendor-sfc-runtime'
  }

  if (
    enabled.richText
    && (
      includesPackage(path, '@tiptap/core')
      || path.includes('/node_modules/@tiptap/')
      || path.includes('/node_modules/prosemirror-')
      || includesPackage(path, 'linkifyjs')
      || includesPackage(path, 'rope-sequence')
    )
  ) {
    return 'vendor-rich-text'
  }

  if (
    enabled.antd
    && (
      includesPackage(path, 'ant-design-vue')
      || path.includes('/node_modules/@ant-design/')
    )
  ) {
    return 'vendor-antd'
  }

  if (
    enabled.element
    && (
      includesPackage(path, 'element-plus')
      || path.includes('/node_modules/@element-plus/')
    )
  ) {
    return 'vendor-element'
  }

  if (
    enabled.configForm
    && (
      path.includes('/packages/ConfigForm/')
      || path.includes('/node_modules/@moluoxixi/config-form')
      || includesPackage(path, 'zod')
    )
  ) {
    return 'vendor-config-form'
  }

  if (enabled.query && path.includes('/node_modules/@tanstack/'))
    return 'vendor-query'

  return undefined
}

/**
 * Add stable dependency-domain chunks without replacing VitePress' own chunking rules.
 * SSR builds are intentionally left untouched because these browser cache boundaries do
 * not help server bundles and may change their initialization order.
 */
export function createStableChunksPlugin(options: StableChunkOptions = {}) {
  return {
    name: 'moluoxixi:stable-chunks',
    enforce: 'post' as const,
    configResolved(config: ResolvedViteConfigLike): void {
      if (config.build.ssr)
        return

      const configuredOutput = config.build.rollupOptions.output
      const outputs = Array.isArray(configuredOutput) ? configuredOutput : [configuredOutput ?? {}]

      if (!configuredOutput)
        config.build.rollupOptions.output = outputs[0]

      for (const output of outputs) {
        const fallback = output.manualChunks

        // Rollup's object form has dependency-grouping semantics that cannot be
        // composed faithfully with a function. Preserve it instead of silently
        // discarding the application's explicit chunk map.
        if (fallback && typeof fallback !== 'function')
          continue

        output.manualChunks = (id, api) => {
          const stableChunk = getStableChunkName(id, options)
          if (stableChunk)
            return stableChunk
          return fallback?.(id, api)
        }
      }
    },
  }
}
