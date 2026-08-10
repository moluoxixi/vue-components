// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  collectElementPlusDocsDemos,
  elementPlusDocsDemoPlugin,
} from '@moluoxixi/vitepress-theme-element-plus/markdown'
import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { createDocsDemoSourceHrefResolver } from './demo-source-links'

describe('docs demo source links', () => {
  it('targets the original Markdown fence lines on GitHub', () => {
    const root = resolve(import.meta.dirname, '../../../..')
    const sourcePath = resolve(root, 'packages/components/src/CopyText/docs/index.md')
    const markdown = readFileSync(sourcePath, 'utf8')
    const md = new MarkdownIt()
    md.use(elementPlusDocsDemoPlugin)
    const demo = collectElementPlusDocsDemos(md, markdown)[0]
    expect(demo).toBeDefined()

    const resolveSourceHref = createDocsDemoSourceHrefResolver(md, root)
    const href = resolveSourceHref({
      ...demo!,
      environment: { relativePath: 'components/copy-text.md' },
    })

    expect(href).toBe(
      `https://github.com/moluoxixi/vue-components/blob/main/packages/components/src/CopyText/docs/index.md?plain=1#L${demo!.startLine}-L${demo!.endLine}`,
    )
    const lines = markdown.split(/\r?\n/)
    expect(lines[demo!.startLine - 1]).toMatch(/^```/)
    expect(lines[demo!.endLine - 1]).toMatch(/^```/)
  })

  it('does not attach a source link to an unrelated generated route', () => {
    const root = resolve(import.meta.dirname, '../../../..')
    const sourcePath = resolve(root, 'packages/components/src/CopyText/docs/index.md')
    const md = new MarkdownIt()
    md.use(elementPlusDocsDemoPlugin)
    const demo = collectElementPlusDocsDemos(md, readFileSync(sourcePath, 'utf8'))[0]!
    const resolveSourceHref = createDocsDemoSourceHrefResolver(md, root)

    expect(resolveSourceHref({
      ...demo,
      environment: { relativePath: 'components/config-table.md' },
    })).toBeUndefined()
  })
})
