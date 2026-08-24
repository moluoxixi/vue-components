import { Buffer } from 'node:buffer'
import MarkdownIt from 'markdown-it'
import { describe, expect, it, vi } from 'vitest'
import {
  collectElementPlusDocsDemos,
  createElementPlusDocsDemoId,
  formatSfcTypeScript,
  sfcTs2js,
} from '../markdown'
import { elementPlusDocsDemoPlugin } from '../src/markdown/demo'

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
    const resolveExternalProjectSource = vi.fn(context => ({
      dependencies: { '@example/components': '^1.2.3' },
      source: context.code,
    }))
    const environment = { relativePath: 'components/example.md' }
    const md = new MarkdownIt({
      highlight: (code, language) => `<pre data-language="${language}">${code}</pre>`,
    })
    md.use(elementPlusDocsDemoPlugin, { resolveExternalProjectSource, resolveSourceHref })

    const html = md.render(source, environment)
    const tsSource = decodeAttribute(html, 'code')
    const jsSource = decodeAttribute(html, 'js-code')
    const externalProject = JSON.parse(decodeAttribute(html, 'external-project-code'))
    const externalJavaScriptProject = JSON.parse(decodeAttribute(html, 'external-project-js-code'))

    expect(tsSource).toContain('const count: number = 1')
    expect(jsSource).toContain('const count = 1')
    expect(jsSource).not.toContain('lang="ts"')
    expect(jsSource).not.toContain(': number')
    expect(jsSource).toBe(tsSource
      .replace(' lang="ts"', '')
      .replace(': number', ''))
    expect(externalProject).toEqual({
      dependencies: { '@example/components': '^1.2.3' },
      source: tsSource,
    })
    expect(externalJavaScriptProject.source).toBe(jsSource)
    expect(resolveExternalProjectSource.mock.calls.map(([context]) => context.sourceLanguage)).toEqual(['TS', 'JS'])
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
  it('formats TypeScript and JavaScript variants with the same style', () => {
    const source = `<script setup lang="ts">
import type { Ref } from 'vue'
import { ref } from 'vue'

interface Row {
  id: number
}

const rows: Ref<Row[]> = ref([{ id: 1 }])
</script>

<template>
  <p>{{ rows[0]?.id }}</p>
</template>`

    const typeScript = formatSfcTypeScript(source)
    const javaScript = sfcTs2js(typeScript)

    expect(typeScript).toContain('const rows: Ref<Row[]> = ref([{ id: 1 }])')
    expect(javaScript).toContain('const rows = ref([{ id: 1 }])')
    expect(javaScript).not.toContain('interface Row')
    expect(typeScript.slice(typeScript.indexOf('<template>')))
      .toBe(javaScript.slice(javaScript.indexOf('<template>')))
  })

  it('transforms every TypeScript script block and accepts spaced lang attributes', () => {
    const source = `<script lang = 'ts'>
export const load = (): number => 1
</script>

<script setup lang="ts">
interface Row { id: number }
const row: Row = { id: load() }
</script>

<template>{{ row.id }}</template>`

    const typeScript = formatSfcTypeScript(source)
    const javaScript = sfcTs2js(typeScript)

    expect(typeScript).toContain('<script lang="ts">\nexport const load = (): number => 1')
    expect(typeScript).toContain('const row: Row = { id: load() }')
    expect(javaScript).toContain('<script>\nexport const load = () => 1')
    expect(javaScript).toContain('<script setup>\nconst row = { id: load() }')
    expect(javaScript).not.toMatch(/\blang\s*=\s*['"]ts['"]|interface Row|: Row|: number/)
  })

  it('preserves TSX script attributes while changing the language to JSX', () => {
    const source = '<script generic="T" lang=\'tsx\'>const value: number = 1</script>'

    expect(sfcTs2js(formatSfcTypeScript(source)))
      .toBe('<script generic="T" lang="jsx">\nconst value = 1\n</script>')
  })

  it('formats nested demo data consistently in TypeScript and JavaScript', () => {
    const source = `<script setup lang="ts">
interface RegionOption {
  value: string
  label: string
  children?: RegionOption[]
}

async function queryRegions(): Promise<RegionOption[]> {
    await new Promise<void>(resolve => setTimeout(resolve, 200));
    return [
        { value: '110000', label: '北京市', children: [
                { value: '110100', label: '北京市', children: [
                        { value: '110101', label: '东城区' },
                        { value: '110102', label: '西城区' },
                    ] },
            ] },
    ];
}
</script>

<template>
  <div>{{ queryRegions }}</div>
</template>`

    const typeScript = formatSfcTypeScript(source)
    const javaScript = sfcTs2js(typeScript)
    const nestedOptions = `return [
    {
      value: '110000',
      label: '北京市',
      children: [
        {
          value: '110100',
          label: '北京市',
          children: [
            { value: '110101', label: '东城区' },
            { value: '110102', label: '西城区' },
          ],
        },
      ],
    },
  ]`

    expect(typeScript).toContain(nestedOptions)
    expect(javaScript).toContain(nestedOptions)
    expect(typeScript).toContain('async function queryRegions(): Promise<RegionOption[]>')
    expect(javaScript).toContain('async function queryRegions()')
    expect(javaScript).not.toMatch(/RegionOption|Promise<void>/)
    expect(typeScript.slice(typeScript.indexOf('<template>')))
      .toBe(javaScript.slice(javaScript.indexOf('<template>')))
  })

  it('does not treat similarly named attributes as the script language', () => {
    const source = '<script data-lang="ts">const value = 1</script>'

    expect(formatSfcTypeScript(source)).toBe(`<script data-lang="ts">
const value = 1
</script>`)
    expect(sfcTs2js(source)).toBe(source)
  })

  it('leaves JavaScript-only SFCs unchanged', () => {
    const source = '<script setup>const value = 1</script>\n<template>{{ value }}</template>'
    expect(sfcTs2js(source)).toBe(source)
  })
})
