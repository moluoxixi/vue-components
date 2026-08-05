// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import {
  createStableChunksPlugin,
  getStableChunkName,
} from '../../../../scripts/vite-chunks'

interface OutputLike {
  manualChunks?: ((id: string, api: unknown) => string | undefined) | Record<string, string[]>
}

function resolvePlugin(output: OutputLike | OutputLike[], ssr: boolean | string = false): void {
  createStableChunksPlugin().configResolved({
    build: {
      rollupOptions: { output },
      ssr,
    },
  })
}

describe('stable Vite chunks', () => {
  it('normalizes Windows paths before matching dependency domains', () => {
    expect(getStableChunkName('D:\\repo\\node_modules\\element-plus\\es\\index.mjs'))
      .toBe('vendor-element')
    expect(getStableChunkName('/repo/node_modules/@tiptap/core/dist/index.js'))
      .toBe('vendor-rich-text')
  })

  it('runs an existing function rule when no stable domain matches', () => {
    const fallback = vi.fn(() => 'app-feature')
    const output: OutputLike = { manualChunks: fallback }
    const api = {}

    resolvePlugin(output)

    expect(typeof output.manualChunks).toBe('function')
    expect((output.manualChunks as (id: string, api: unknown) => string | undefined)(
      '/repo/src/feature.ts',
      api,
    )).toBe('app-feature')
    expect(fallback).toHaveBeenCalledWith('/repo/src/feature.ts', api)
  })

  it('preserves an object rule because its dependency grouping cannot be composed as a function', () => {
    const manualChunks = { framework: ['vue'] }
    const output: OutputLike = { manualChunks }

    resolvePlugin(output)

    expect(output.manualChunks).toBe(manualChunks)
  })

  it('leaves SSR output untouched', () => {
    const fallback = vi.fn(() => 'server')
    const output: OutputLike = { manualChunks: fallback }

    resolvePlugin(output, true)

    expect(output.manualChunks).toBe(fallback)
  })

  it('applies stable rules to every function-based Rollup output', () => {
    const outputs: OutputLike[] = [{}, {}]

    resolvePlugin(outputs)

    for (const output of outputs) {
      expect((output.manualChunks as (id: string, api: unknown) => string | undefined)(
        '/repo/node_modules/@tanstack/vue-query/build/index.js',
        {},
      )).toBe('vendor-query')
    }
  })
})
