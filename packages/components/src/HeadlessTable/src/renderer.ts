import type { App, InjectionKey } from 'vue'
import type {
  HeadlessTableRendererConfig,
  HeadlessTableRendererDefinition,
  HeadlessTableRendererMap,
  HeadlessTableRendererOptions,
  HeadlessTableRendererPlugin,
  HeadlessTableRendererPluginOptions,
  HeadlessTableRendererRegistry,
  HeadlessTableRow,
} from './types'
import { provide, shallowReactive } from 'vue'

class RendererRegistry implements HeadlessTableRendererRegistry {
  private readonly renderers = shallowReactive(
    new Map<string, HeadlessTableRendererDefinition<any>>(),
  )

  add<TRow extends HeadlessTableRow = HeadlessTableRow>(
    name: string,
    renderer: HeadlessTableRendererDefinition<TRow>,
  ): this {
    if (!name.trim())
      throw new Error('[HeadlessTable] renderer name cannot be empty')

    if (this.renderers.has(name)) {
      throw new Error(
        `[HeadlessTable] renderer "${name}" already exists; use replace() for an intentional override`,
      )
    }

    this.renderers.set(name, renderer as HeadlessTableRendererDefinition<any>)
    return this
  }

  replace<TRow extends HeadlessTableRow = HeadlessTableRow>(
    name: string,
    renderer: HeadlessTableRendererDefinition<TRow>,
  ): this {
    if (!name.trim())
      throw new Error('[HeadlessTable] renderer name cannot be empty')

    this.renderers.set(name, renderer as HeadlessTableRendererDefinition<any>)
    return this
  }

  mixin(renderers: HeadlessTableRendererMap<any>, options: { replace?: boolean } = {}): this {
    Object.entries(renderers).forEach(([name, renderer]) => {
      if (options.replace)
        this.replace(name, renderer)
      else
        this.add(name, renderer)
    })
    return this
  }

  get(name: string): HeadlessTableRendererDefinition<any> | undefined {
    return this.renderers.get(name)
  }

  has(name: string): boolean {
    return this.renderers.has(name)
  }

  delete(name: string): boolean {
    return this.renderers.delete(name)
  }

  clear(): void {
    this.renderers.clear()
  }
}

export function createHeadlessTableRenderer(): HeadlessTableRendererRegistry {
  return new RendererRegistry()
}

export function defineHeadlessTableRenderer<
  TRow extends HeadlessTableRow = HeadlessTableRow,
  TProps extends Record<string, any> = Record<string, any>,
  TOptions = any,
>(
  renderer: HeadlessTableRendererDefinition<TRow, TProps, TOptions>,
): HeadlessTableRendererDefinition<TRow, TProps, TOptions> {
  return renderer
}

export const headlessTableRenderer = createHeadlessTableRenderer()

export const headlessTableRendererKey: InjectionKey<HeadlessTableRendererRegistry>
  = Symbol('headless-table-renderer')

export function provideHeadlessTableRenderer(
  registry: HeadlessTableRendererRegistry = createHeadlessTableRenderer(),
): HeadlessTableRendererRegistry {
  provide(headlessTableRendererKey, registry)
  return registry
}

export function createHeadlessTableRendererPlugin(
  options: HeadlessTableRendererPluginOptions | HeadlessTableRendererRegistry = {},
): HeadlessTableRendererPlugin {
  const registry = 'get' in options && 'mixin' in options
    ? options
    : options.registry ?? createHeadlessTableRenderer()

  if (!('get' in options && 'mixin' in options) && options.renderers) {
    registry.mixin(options.renderers, { replace: options.replace })
  }

  return {
    registry,
    install(app: App) {
      app.provide(headlessTableRendererKey, registry)
    },
  }
}

export function normalizeHeadlessTableRendererOptions(
  config: HeadlessTableRendererConfig,
): HeadlessTableRendererOptions {
  return typeof config === 'string' ? { name: config } : config
}

export function resolveHeadlessTableRenderer<TRow extends HeadlessTableRow = HeadlessTableRow>(
  config: HeadlessTableRendererConfig,
  renderers: HeadlessTableRendererMap<TRow>,
  registry: HeadlessTableRendererRegistry,
): {
  options: HeadlessTableRendererOptions
  renderer?: HeadlessTableRendererDefinition<TRow>
} {
  const options = normalizeHeadlessTableRendererOptions(config)
  const localCandidate = renderers[options.name]
  const localRenderer = Object.hasOwn(renderers, options.name)
    ? localCandidate
    : undefined

  return {
    options,
    renderer: localRenderer
      ?? registry.get(options.name) as HeadlessTableRendererDefinition<TRow> | undefined,
  }
}
