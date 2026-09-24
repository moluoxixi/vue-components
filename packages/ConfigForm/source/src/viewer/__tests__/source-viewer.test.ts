// @vitest-environment happy-dom

import type { SourceFileSetV1 } from '../../generator'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConfigFormSourceViewer from '../index.vue'

const monacoMocks = vi.hoisted(() => {
  const dispose = vi.fn()
  const mount = vi.fn(() => ({ dispose, update: vi.fn() }))
  const load = vi.fn(async () => ({ mount }))
  return { dispose, load, mount }
})

vi.mock('../services/monaco-loader', () => ({
  loadMonacoViewerRuntime: monacoMocks.load,
}))

function createFileSet(): SourceFileSetV1 {
  return {
    entry: 'src/main.ts',
    files: [
      {
        contentBase64: 'AAECAw==',
        encoding: 'base64',
        kind: 'binary',
        mediaType: 'image/png',
        path: 'src/assets/brand-mark.png',
      },
      {
        content: '<template><main>Home</main></template>',
        kind: 'text',
        language: 'vue',
        path: 'src/surfaces/a-very-long-surface-directory-name/HomeSurface.vue',
      },
      {
        content: 'import "./App.vue"',
        kind: 'text',
        language: 'typescript',
        path: 'src/main.ts',
      },
      {
        content: '{"private":true}',
        kind: 'text',
        language: 'json',
        path: 'package.json',
      },
    ],
    kind: 'raw-source',
    version: 1,
  }
}

describe('config form source viewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    monacoMocks.load.mockImplementation(async () => ({ mount: monacoMocks.mount }))
    monacoMocks.mount.mockImplementation(() => ({
      dispose: monacoMocks.dispose,
      update: vi.fn(),
    }))
  })

  it('emits selection without taking ownership of the controlled path', async () => {
    const files = createFileSet()
    const wrapper = mount(ConfigFormSourceViewer, {
      attachTo: document.body,
      props: { files, selectedPath: 'package.json' },
    })
    await flushPromises()

    expect(wrapper.get('.config-form-source-viewer__path').text()).toBe('package.json')
    await wrapper.get('[data-source-tree-id="file:src/main.ts"] .config-form-source-viewer__tree-row').trigger('click')

    expect(wrapper.emitted('update:selectedPath')?.at(-1)).toEqual(['src/main.ts'])
    expect(wrapper.get('.config-form-source-viewer__path').text()).toBe('package.json')

    await wrapper.setProps({ selectedPath: 'src/main.ts' })
    expect(wrapper.get('.config-form-source-viewer__path').text()).toBe('src/main.ts')
    expect(wrapper.get('[data-source-tree-id="file:src/main.ts"]').attributes('aria-selected')).toBe('true')
    wrapper.unmount()
  })

  it('never loads Monaco for binary files and disposes it when text leaves the view', async () => {
    const files = createFileSet()
    const wrapper = mount(ConfigFormSourceViewer, {
      props: { files, selectedPath: 'src/assets/brand-mark.png' },
    })
    await flushPromises()

    expect(wrapper.get('.config-form-source-viewer__binary-state').text()).toContain('4 bytes')
    expect(wrapper.text()).not.toContain('AAECAw==')
    expect(monacoMocks.load).not.toHaveBeenCalled()

    await wrapper.setProps({ selectedPath: 'src/main.ts' })
    await flushPromises()
    expect(monacoMocks.load).toHaveBeenCalledOnce()
    expect(monacoMocks.mount).toHaveBeenCalledOnce()

    await wrapper.setProps({ selectedPath: 'src/assets/brand-mark.png' })
    expect(monacoMocks.dispose).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('renders empty, missing-selection, long-path, and mobile pane states', async () => {
    const wrapper = mount(ConfigFormSourceViewer, {
      props: { files: undefined, selectedPath: '' },
    })
    expect(wrapper.get('.config-form-source-viewer__empty-state').text()).toContain('No source files')

    const files = createFileSet()
    await wrapper.setProps({ files, selectedPath: 'missing/deeply/nested/file.ts' })
    expect(wrapper.get('.config-form-source-viewer__missing-state').text()).toContain('File unavailable')
    expect(wrapper.get('.config-form-source-viewer__path').attributes('title')).toBe('missing/deeply/nested/file.ts')

    await wrapper.setProps({ selectedPath: 'src/surfaces/a-very-long-surface-directory-name/HomeSurface.vue' })
    const longTreeItem = wrapper.get('[data-source-tree-id="file:src/surfaces/a-very-long-surface-directory-name/HomeSurface.vue"]')
    expect(longTreeItem.get('.config-form-source-viewer__tree-row').attributes('title')).toBe(
      'src/surfaces/a-very-long-surface-directory-name/HomeSurface.vue',
    )

    const filesButton = wrapper.get('button[aria-controls$="-tree-pane"]')
    await filesButton.trigger('click')
    expect(filesButton.attributes('aria-pressed')).toBe('true')
    expect(wrapper.attributes('data-active-pane')).toBe('tree')
    wrapper.unmount()
  })

  it('supports roving tree focus, typeahead, and keyboard activation', async () => {
    const wrapper = mount(ConfigFormSourceViewer, {
      attachTo: document.body,
      props: { files: createFileSet(), selectedPath: 'package.json' },
    })
    const packageItem = wrapper.get('[data-source-tree-id="file:package.json"]')
    ;(packageItem.element as HTMLElement).focus()
    await packageItem.trigger('keydown', { key: 'h' })

    const homeItem = wrapper.get('[data-source-tree-id="file:src/surfaces/a-very-long-surface-directory-name/HomeSurface.vue"]')
    expect(document.activeElement).toBe(homeItem.element)
    await homeItem.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:selectedPath')?.at(-1)).toEqual([
      'src/surfaces/a-very-long-surface-directory-name/HomeSurface.vue',
    ])
    wrapper.unmount()
  })

  it('does not mount a late Monaco runtime after unmount', async () => {
    let resolveRuntime: ((runtime: { mount: typeof monacoMocks.mount }) => void) | undefined
    monacoMocks.load.mockImplementation(() => new Promise((resolve) => {
      resolveRuntime = resolve
    }))
    const wrapper = mount(ConfigFormSourceViewer, {
      props: { files: createFileSet(), selectedPath: 'src/main.ts' },
    })
    wrapper.unmount()
    resolveRuntime?.({ mount: monacoMocks.mount })
    await flushPromises()

    expect(monacoMocks.mount).not.toHaveBeenCalled()
  })
})
