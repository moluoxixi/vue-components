import type {
  HeadlessTableRendererDefinition,
  HeadlessTableRendererMap,
  HeadlessTableRendererRegistry,
  HeadlessTableRow,
} from './types'
import { shallowReactive } from 'vue'

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

    this.renderers.set(name, renderer as HeadlessTableRendererDefinition<any>)
    return this
  }

  mixin(renderers: HeadlessTableRendererMap<any>): this {
    Object.entries(renderers).forEach(([name, renderer]) => this.add(name, renderer))
    return this
  }

  get(name: string): HeadlessTableRendererDefinition<any> | undefined {
    return this.renderers.get(name)
  }

  delete(name: string): boolean {
    return this.renderers.delete(name)
  }
}

export function createHeadlessTableRenderer(): HeadlessTableRendererRegistry {
  return new RendererRegistry()
}

export const headlessTableRenderer = createHeadlessTableRenderer()
