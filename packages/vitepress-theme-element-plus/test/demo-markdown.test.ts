import { Buffer } from 'node:buffer'
import MarkdownIt from 'markdown-it'
import { describe, expect, it, vi } from 'vitest'
import {
  collectElementPlusDocsDemos,
  createElementPlusDocsDemoId,
  elementPlusDocsDemoPlugin,
  sfcTs2js,
} from '../markdown'

function decodeAttribute(html: string, name: string): string {
  const value = new RegExp(`${name}="([^"]+)"`).exec(html)?.[1]
  if (!value)
    throw new Error(`Missing ${name} attribute`)
  return Buffer.from(value, 'base64').toString('utf8')
}

describe('createElementPlusDocsDemoId', () => {
  it('is stable for the same title and source', () => {
    const source = '<template><div>Hello</div></template>'
    expect(createElementPlusDocsDemoId('Basic', source)).toBe(createElementPlusDocsDemoId('Basic', source))
    expect(createElementPlusDocsDemoId('Basic', source)).toMatch(/^demo-[a-f0-9]{16}$/)
  })

  it('changes when the title or source changes', () => {
    const source = '<template><div>Hello</div></template>'
    expect(createElementPlusDocsDemoId('Basic', source)).not.toBe(createElementPlusDocsDemoId('Advanced', source))
    expect(createElementPlusDocsDemoId('Basic', source)).not.toBe(createElementPlusDocsDemoId('Basic', `${source}\n`))
  })
})

describe('elementPlusDocsDemoPlugin', () => {
  const source = `:::demo Typed counter
\`\`\`vue
<script setup lang="ts">
const count: number = 1
</script>

<template><p>{{ count }}</p></template>
\`\`\`
:::
`

  it('projects TypeScript demos into TS and generated JS source variants', () => {
    const resolveSourceHref = vi.fn(() => 'https://github.com/example/repo/blob/main/demo.md#L2-L8')
    const environment = { relativePath: 'components/example.md' }
    const md = new MarkdownIt({
      highlight: (code, language) => `<pre data-language="${language}">${code}</pre>`,
    })
    md.use(elementPlusDocsDemoPlugin, { resolveSourceHref })

    const html = md.render(source, environment)
    const tsSource = decodeAttribute(html, 'code')
    const jsSource = decodeAttribute(html, 'js-code')

    expect(tsSource).toContain('const count: number = 1')
    expect(jsSource).toContain('const count = 1;')
    expect(jsSource).not.toContain('lang="ts"')
    expect(jsSource).not.toContain(': number')
    expect(html).toContain('js-highlighted=')
    expect(html).toContain('source-href="https://github.com/example/repo/blob/main/demo.md#L2-L8"')
    expect(resolveSourceHref).toHaveBeenCalledWith(expect.objectContaining({
      environment,
      title: 'Typed counter',
    }))
  })

  it('collects the original Markdown fence line range with the stable demo id', () => {
    const md = new MarkdownIt()
    md.use(elementPlusDocsDemoPlugin)

    const demos = collectElementPlusDocsDemos(md, source)

    expect(demos).toHaveLength(1)
    expect(demos[0]).toMatchObject({
      demoId: createElementPlusDocsDemoId('Typed counter', demos[0]!.code),
      endLine: 8,
      startLine: 2,
      title: 'Typed counter',
    })
  })
})

describe('sfcTs2js', () => {
  it('leaves JavaScript-only SFCs unchanged', () => {
    const source = '<script setup>const value = 1</script>\n<template>{{ value }}</template>'
    expect(sfcTs2js(source)).toBe(source)
  })
})
