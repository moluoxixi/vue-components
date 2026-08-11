// @vitest-environment happy-dom
import type { ElementPlusDocsDemoMessages, ElementPlusDocsExternalProjectSource } from '../index'
import { Buffer } from 'node:buffer'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { ElementPlusDocsDemo } from '../index'

const messages: ElementPlusDocsDemoMessages = {
  actions: 'Example actions',
  codeCopied: 'Code copied',
  collapseCode: 'Collapse code',
  collapseExampleCode: 'Collapse example source',
  compileError: 'Compile error',
  copied: 'Copied',
  copyCode: 'Copy code',
  expandCode: 'Expand code',
  expandExampleCode: 'Expand example source',
  foldCodeRegion: 'Fold code region',
  foldedLine: '{lines} line folded',
  foldedLines: '{lines} lines folded',
  loading: 'Loading',
  openCodeSandbox: 'Edit in CodeSandbox',
  openElementPlusPlayground: 'Edit in Vue Playground',
  openPlayground: 'Edit in lightweight playground',
  openStackBlitz: 'Edit in StackBlitz',
  playgroundUnavailable: 'Playground unavailable',
  sourceLanguage: 'Example source language',
  unfoldCodeRegion: 'Unfold code region',
  viewSource: 'View example source',
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

function mountDemo(options: {
  copy?: (source: string) => Promise<void>
  demoId?: string
  externalProjectCode?: string
  externalProjectJsCode?: string
  openCodeSandbox?: (source: string, demoId: string, projectSource?: ElementPlusDocsExternalProjectSource) => void | Promise<void>
  openElementPlusPlayground?: (source: string, demoId: string) => void | Promise<void>
  openPlayground?: (source: string, demoId: string) => void | Promise<void>
  openStackBlitz?: (source: string, demoId: string, projectSource?: ElementPlusDocsExternalProjectSource) => void | Promise<void>
} = {}) {
  const tsSource = '<script setup lang="ts">const value: number = 1</script><template>{{ value }}</template>'
  const jsSource = '<script setup>const value = 1;</script><template>{{ value }}</template>'
  const compile = vi.fn().mockResolvedValue({
    component: defineComponent(() => () => h('p', 'preview')),
    dispose: vi.fn(),
  })
  const wrapper = mount(ElementPlusDocsDemo, {
    props: {
      code: encode(tsSource),
      compile,
      copy: options.copy,
      demoId: options.demoId ?? 'demo-test',
      externalProjectCode: options.externalProjectCode,
      externalProjectJsCode: options.externalProjectJsCode,
      highlighted: encode('<pre>TS source</pre>'),
      jsCode: encode(jsSource),
      jsHighlighted: encode('<pre>JS source</pre>'),
      messages,
      openCodeSandbox: options.openCodeSandbox,
      openElementPlusPlayground: options.openElementPlusPlayground,
      openPlayground: options.openPlayground,
      openStackBlitz: options.openStackBlitz,
      sourceHref: 'https://github.com/example/repo/blob/main/demo.md#L2-L8',
    },
    global: {
      stubs: {
        ClientOnly: { template: '<slot />' },
      },
    },
    attachTo: document.body,
  })
  return { compile, jsSource, tsSource, wrapper }
}

describe('elementPlusDocsDemo', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('keeps the TS preview runtime while copy and playground follow the selected source', async () => {
    const copy = vi.fn().mockResolvedValue(undefined)
    const openPlayground = vi.fn()
    const openElementPlusPlayground = vi.fn()
    const openStackBlitz = vi.fn()
    const openCodeSandbox = vi.fn()
    const { compile, jsSource, tsSource, wrapper } = mountDemo({
      copy,
      openCodeSandbox,
      openElementPlusPlayground,
      openPlayground,
      openStackBlitz,
    })
    await flushPromises()

    expect(compile).toHaveBeenCalledWith(tsSource, expect.objectContaining({ id: 'demo-test' }))
    const languageOptions = wrapper.get('[data-testid="demo-source-language"]').findAll('.el-segmented__item')
    const jsOption = languageOptions.find(option => option.text() === 'JS')
    expect(jsOption).toBeDefined()
    await jsOption!.trigger('click')

    await wrapper.get('button[aria-label="Copy code"]').trigger('click')
    await wrapper.get('button[aria-label="Edit in lightweight playground"]').trigger('click')
    await wrapper.get('button[aria-label="Edit in Vue Playground"]').trigger('click')
    await wrapper.get('button[aria-label="Edit in StackBlitz"]').trigger('click')
    await wrapper.get('button[aria-label="Edit in CodeSandbox"]').trigger('click')
    await flushPromises()

    expect(copy).toHaveBeenCalledWith(jsSource)
    expect(openPlayground).toHaveBeenCalledWith(jsSource, 'demo-test')
    expect(openElementPlusPlayground).toHaveBeenCalledWith(jsSource, 'demo-test')
    expect(openStackBlitz).toHaveBeenCalledWith(jsSource, 'demo-test')
    expect(openCodeSandbox).toHaveBeenCalledWith(jsSource, 'demo-test')
    expect(compile).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('uses localized titles and accessible names for every playground action', async () => {
    const { wrapper } = mountDemo({
      openCodeSandbox: vi.fn(),
      openElementPlusPlayground: vi.fn(),
      openPlayground: vi.fn(),
      openStackBlitz: vi.fn(),
    })
    await flushPromises()

    const actions = [
      ['demo-codesandbox', 'Edit in CodeSandbox'],
      ['demo-stackblitz', 'Edit in StackBlitz'],
      ['demo-element-plus-playground', 'Edit in Vue Playground'],
      ['demo-lightweight-playground', 'Edit in lightweight playground'],
    ] as const
    expect(wrapper.findAll('.demo-actions > [data-testid]').slice(0, 4).map(action => action.attributes('data-testid'))).toEqual(
      actions.map(([testId]) => testId),
    )
    for (const [testId, label] of actions) {
      const action = wrapper.get(`[data-testid="${testId}"]`)
      expect(action.attributes('title')).toBe(label)
      expect(action.attributes('aria-label')).toBe(label)
    }

    wrapper.unmount()
  })

  it('passes the selected build-time project descriptor to external playgrounds', async () => {
    const openStackBlitz = vi.fn()
    const openCodeSandbox = vi.fn()
    const tsProjectSource = {
      dependencies: { '@example/components': '^1.2.3' },
      source: '<template>resolved TS</template>',
    }
    const jsProjectSource = {
      dependencies: { '@example/components': '^1.2.4' },
      source: '<template>resolved JS</template>',
    }
    const { jsSource, wrapper } = mountDemo({
      externalProjectCode: encode(JSON.stringify(tsProjectSource)),
      externalProjectJsCode: encode(JSON.stringify(jsProjectSource)),
      openCodeSandbox,
      openStackBlitz,
    })
    await flushPromises()

    const languageOptions = wrapper.get('[data-testid="demo-source-language"]').findAll('.el-segmented__item')
    await languageOptions.find(option => option.text() === 'JS')!.trigger('click')
    await wrapper.get('[data-testid="demo-stackblitz"]').trigger('click')
    await wrapper.get('[data-testid="demo-codesandbox"]').trigger('click')
    await flushPromises()

    expect(openStackBlitz).toHaveBeenCalledWith(jsSource, 'demo-test', jsProjectSource)
    expect(openCodeSandbox).toHaveBeenCalledWith(jsSource, 'demo-test', jsProjectSource)
    wrapper.unmount()
  })

  it('keeps the selected source language isolated to the current demo', async () => {
    const firstCopy = vi.fn().mockResolvedValue(undefined)
    const secondCopy = vi.fn().mockResolvedValue(undefined)
    const firstStackBlitz = vi.fn()
    const secondStackBlitz = vi.fn()
    const firstCodeSandbox = vi.fn()
    const secondCodeSandbox = vi.fn()
    const first = mountDemo({
      copy: firstCopy,
      demoId: 'same-demo',
      openCodeSandbox: firstCodeSandbox,
      openStackBlitz: firstStackBlitz,
    })
    const second = mountDemo({
      copy: secondCopy,
      demoId: 'same-demo',
      openCodeSandbox: secondCodeSandbox,
      openStackBlitz: secondStackBlitz,
    })
    await flushPromises()

    const firstOptions = first.wrapper.get('[data-testid="demo-source-language"]').findAll('.el-segmented__item')
    await firstOptions.find(option => option.text() === 'JS')!.trigger('click')
    await first.wrapper.get('button[aria-label="Copy code"]').trigger('click')
    await second.wrapper.get('button[aria-label="Copy code"]').trigger('click')
    await first.wrapper.get('[data-testid="demo-stackblitz"]').trigger('click')
    await second.wrapper.get('[data-testid="demo-stackblitz"]').trigger('click')
    await first.wrapper.get('[data-testid="demo-codesandbox"]').trigger('click')
    await second.wrapper.get('[data-testid="demo-codesandbox"]').trigger('click')
    await flushPromises()

    expect(firstCopy).toHaveBeenCalledWith(first.jsSource)
    expect(secondCopy).toHaveBeenCalledWith(second.tsSource)
    expect(firstStackBlitz).toHaveBeenCalledWith(first.jsSource, 'same-demo')
    expect(secondStackBlitz).toHaveBeenCalledWith(second.tsSource, 'same-demo')
    expect(firstCodeSandbox).toHaveBeenCalledWith(first.jsSource, 'same-demo')
    expect(secondCodeSandbox).toHaveBeenCalledWith(second.tsSource, 'same-demo')
    expect(window.localStorage.length).toBe(0)
    first.wrapper.unmount()
    second.wrapper.unmount()
  })

  it('renders the source link and collapses source from the bottom control', async () => {
    const { wrapper } = mountDemo()
    await flushPromises()

    expect(wrapper.get('[data-testid="demo-source-link"]').attributes('href'))
      .toBe('https://github.com/example/repo/blob/main/demo.md#L2-L8')
    const toggle = wrapper.get('button[aria-label="Expand example source"]')
    await toggle.trigger('click')
    expect(wrapper.get('.demo-source').attributes('aria-hidden')).toBe('false')

    await wrapper.get('[data-testid="demo-source-collapse"]').trigger('click')
    expect(wrapper.get('.demo-source').attributes('aria-hidden')).toBe('true')
    expect(document.activeElement).toBe(toggle.element)
    wrapper.unmount()
  })
})
