// @vitest-environment happy-dom
import type { ElementPlusDocsDemoMessages } from '../index'
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
  openPlayground: 'Open playground',
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
  openPlayground?: (source: string, demoId: string) => void | Promise<void>
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
      demoId: 'demo-test',
      highlighted: encode('<pre>TS source</pre>'),
      jsCode: encode(jsSource),
      jsHighlighted: encode('<pre>JS source</pre>'),
      messages,
      openPlayground: options.openPlayground,
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
    const { compile, jsSource, tsSource, wrapper } = mountDemo({ copy, openPlayground })
    await flushPromises()

    expect(compile).toHaveBeenCalledWith(tsSource, expect.objectContaining({ id: 'demo-test' }))
    const languageOptions = wrapper.get('[data-testid="demo-source-language"]').findAll('.el-segmented__item')
    const jsOption = languageOptions.find(option => option.text() === 'JS')
    expect(jsOption).toBeDefined()
    await jsOption!.trigger('click')

    await wrapper.get('button[aria-label="Copy code"]').trigger('click')
    await wrapper.get('button[aria-label="Open playground"]').trigger('click')
    await flushPromises()

    expect(copy).toHaveBeenCalledWith(jsSource)
    expect(openPlayground).toHaveBeenCalledWith(jsSource, 'demo-test')
    expect(compile).toHaveBeenCalledOnce()
    wrapper.unmount()
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
