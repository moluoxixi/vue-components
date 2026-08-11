import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElementPlusDocsExternalProject } from '@moluoxixi/vitepress-theme-element-plus'
import {
  collectElementPlusDocsDemos,
  elementPlusDocsDemoPlugin,
  sfcTs2js,
} from '@moluoxixi/vitepress-theme-element-plus/markdown'
import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { resolveComponentsExternalProjectSource } from './playground-external'

const componentSourceRoot = fileURLToPath(new URL('../../../../packages/components/src/', import.meta.url))

function collectMarkdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory())
      return collectMarkdownFiles(path)
    return entry.name.endsWith('.md') ? [path] : []
  })
}

const demoMarkdown = new MarkdownIt().use(elementPlusDocsDemoPlugin)

function collectVueExamples(markdown: string): string[] {
  return collectElementPlusDocsDemos(demoMarkdown, markdown).map(demo => demo.code)
}

function resolveSource(source: string, sourceLanguage: 'JS' | 'TS' = 'TS') {
  return resolveComponentsExternalProjectSource({
    code: source,
    demoId: 'fixture-demo',
    endLine: 0,
    environment: {},
    sourceLanguage,
    startLine: 0,
    title: 'Fixture',
  })
}

describe('component external playground source', () => {
  it('moves CopyText to its smallest entry without unrelated peers', () => {
    const result = resolveSource(`<script setup lang='ts'>
import { CopyText } from '@moluoxixi/components'
</script>
<template><CopyText text="hello" /></template>`)

    expect(result.source).toContain(`import { CopyText } from '@moluoxixi/components/CopyText'`)
    expect(result.dependencies).toEqual({
      '@moluoxixi/components': 'latest',
      'vue': '^3.5.0',
    })
    expect(result.styleImports).toEqual(['@moluoxixi/components/styles'])
  })

  it('adds the peers detected from a request component entry', () => {
    const result = resolveSource(`<script setup lang='ts'>
import { RequestSelectV2 } from '@moluoxixi/components'
</script>
<template><RequestSelectV2 :query="async () => []" /></template>`)

    expect(result.source).toContain('@moluoxixi/components/RequestSelectV2')
    expect(result.dependencies).toMatchObject({
      '@moluoxixi/components': 'latest',
      '@tanstack/vue-query': '^5.0.0',
      'element-plus': '^2.9.0',
      'vue': '^3.5.0',
    })
    expect(result.styleImports).toContain('element-plus/dist/index.css')
  })

  it('resolves direct demo dependencies from installed package metadata', () => {
    const result = resolveSource(`<script setup lang='ts'>
import { CopyText } from '@moluoxixi/components'
import { ElButton } from 'element-plus'
</script>`)

    const dependencies = result.dependencies ?? {}
    expect(Object.keys(dependencies)).toEqual([
      '@moluoxixi/components',
      'element-plus',
      'vue',
    ])
    expect(dependencies['element-plus']).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('uses AST nodes to split aliases and preserve type-only imports', () => {
    const result = resolveSource(`<script setup lang='ts'>
import {
  CopyText,
  type CopyTextProps,
  useHeadlessTable as createTable,
} from '@moluoxixi/components'
</script>`)

    expect(result.source).toContain(`import { CopyText } from '@moluoxixi/components/CopyText'`)
    expect(result.source).toContain(`import { useHeadlessTable as createTable } from '@moluoxixi/components/HeadlessTable'`)
    expect(result.source).toContain(`import type { CopyTextProps } from '@moluoxixi/components'`)
  })

  it('rejects runtime exports that have no generated subpath metadata', () => {
    expect(() => resolveSource(`<script setup>
import { MissingRuntime } from '@moluoxixi/components'
</script>`)).toThrow('Missing component playground metadata for runtime export "MissingRuntime"')
  })

  it('generates an external project for every documented Vue example', () => {
    const examples = collectMarkdownFiles(componentSourceRoot).flatMap(file => (
      collectVueExamples(readFileSync(file, 'utf8')).map(source => ({ file, source }))
    ))

    expect(examples).toHaveLength(50)
    for (const { file, source } of examples) {
      for (const [sourceLanguage, projectedSource] of [
        ['TS', source],
        ['JS', sfcTs2js(source)],
      ] as const) {
        let projectSource: ReturnType<typeof resolveSource> | undefined
        expect(() => {
          projectSource = resolveSource(projectedSource, sourceLanguage)
        }, `${file} (${sourceLanguage})`).not.toThrow()
        expect(projectSource, `${file} (${sourceLanguage})`).toBeDefined()
        expect(() => createElementPlusDocsExternalProject(projectedSource, {
          title: file,
        }, projectSource!), `${file} (${sourceLanguage})`).not.toThrow()
      }
    }
  })
})
