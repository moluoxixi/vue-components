// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createComponentRoutePaths,
  renderComponentRoute,
} from '../component-routes.mts'

const roots: string[] = []

function createFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'component-doc-routes-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('component documentation routes', () => {
  it('places optional source documentation before the invariant API section', () => {
    const route = renderComponentRoute({
      name: 'CopyText',
      slug: 'copy-text',
      description: '复制文本',
    }, {
      contentStartLine: 1,
      introductionEndLine: 3,
      lastContentLine: 8,
    })

    expect(route).toContain('docs/index.md{1,3}-->\n\n<ComponentDocMeta name="CopyText" slug="copy-text" :has-source-doc="true" />')
    expect(route).toContain('docs/index.md{4,8}-->\n\n## API')
    expect(route).toContain('<ApiDocs name="CopyText" />\n\n## 组件贡献者\n\n<DocContributors name="CopyText" />')
    expect(route).not.toContain('<ComponentCommitTimeline')
    expect(route).not.toContain('id="changelog"')
  })

  it('renders a title and description when source documentation is absent', () => {
    const route = renderComponentRoute({
      name: 'CopyText',
      slug: 'copy-text',
      description: '复制文本',
    })

    expect(route).toContain('# CopyText\n\n复制文本')
    expect(route).toMatch(/复制文本[\s\S]*<ComponentDocMeta[\s\S]*## API[\s\S]*<ApiDocs name="CopyText" \/>/)
  })

  it('renders escaped search-only aliases inside the indexed page section', () => {
    const route = renderComponentRoute({
      name: 'AntdConfigForm',
      slug: 'antd-config-form',
      description: '配置表单',
      searchAliases: ['ConfigForm', '<Form>'],
    })

    expect(route).toContain('<span hidden data-doc-search-aliases>ConfigForm &lt;Form&gt;</span>')
  })

  it('creates dynamic route content from optional component source documentation', () => {
    const root = createFixtureRoot()
    const sourceDir = resolve(root, 'packages/components/src/CopyText/docs')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(resolve(sourceDir, 'index.md'), '# CopyText\n', 'utf8')

    const result = createComponentRoutePaths({
      root,
      components: [{ name: 'CopyText', slug: 'copy-text', description: '复制文本' }],
    })

    expect(result.apiOnly).toEqual([])
    expect(result.paths).toEqual([{
      params: { slug: 'copy-text' },
      content: '<!--@include: ../../../packages/components/src/CopyText/docs/index.md{1,1}-->\n\n<ComponentDocMeta name="CopyText" slug="copy-text" :has-source-doc="true" />\n\n## API\n\n<ApiDocs name="CopyText" />\n\n## 组件贡献者\n\n<DocContributors name="CopyText" />\n',
    }])
  })

  it('generates localized routes from locale-specific source documents', () => {
    const root = createFixtureRoot()
    const sourceDir = resolve(root, 'packages/components/src/CopyText/docs')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(resolve(sourceDir, 'index.en.md'), '# CopyText\n\nEnglish introduction.\n', 'utf8')

    const result = createComponentRoutePaths({
      root,
      components: [{ name: 'CopyText', slug: 'copy-text', description: 'Copy action' }],
      locale: {
        sourceDocFile: 'docs/index.en.md',
        sourceDocIncludePrefix: '../../../../',
        headings: {
          api: 'API',
          contributors: 'Component Contributors',
        },
      },
    })

    expect(result.apiOnly).toEqual([])
    expect(result.paths[0]?.content).toContain('../../../../packages/components/src/CopyText/docs/index.en.md{1,3}')
    expect(result.paths[0]?.content).not.toContain('<ComponentCommitTimeline')
    expect(result.paths[0]?.content).toContain('## Component Contributors')
  })

  it('creates an API-only dynamic route when docs/index.md does not exist', () => {
    const root = createFixtureRoot()

    const result = createComponentRoutePaths({
      root,
      components: [{ name: 'RequestSelectV2', slug: 'request-select-v2', description: '远程选择器' }],
    })

    expect(result.apiOnly).toEqual(['RequestSelectV2'])
    expect(result.paths[0]?.content)
      .toContain('# RequestSelectV2\n\n远程选择器\n\n<ComponentDocMeta name="RequestSelectV2" slug="request-select-v2" :has-source-doc="false" />\n\n## API')
    expect(result.paths[0]?.content)
      .toContain('<ApiDocs name="RequestSelectV2" />\n\n## 组件贡献者\n\n<DocContributors name="RequestSelectV2" />')
  })

  it('resolves package-level source documentation for RichTextEditor', () => {
    const root = createFixtureRoot()
    const sourceDir = resolve(root, 'packages/rich-text-editor/docs')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(resolve(sourceDir, 'index.md'), '# RichTextEditor\n\n富文本编辑器。\n', 'utf8')

    const result = createComponentRoutePaths({
      root,
      components: [{
        docsSourcePath: 'packages/rich-text-editor',
        name: 'RichTextEditor',
        slug: 'rich-text-editor',
        description: '富文本编辑器',
      }],
    })

    expect(result.apiOnly).toEqual([])
    expect(result.paths[0]?.content).toContain('../../../packages/rich-text-editor/docs/index.md{1,3}')
  })

  it('inserts metadata after the first source-document paragraph', () => {
    const root = createFixtureRoot()
    const sourceDir = resolve(root, 'packages/components/src/CopyText/docs')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(resolve(sourceDir, 'index.md'), '# CopyText\n\n首段描述。\n\n第二段说明。\n\n## 示例\n', 'utf8')

    const result = createComponentRoutePaths({
      root,
      components: [{ name: 'CopyText', slug: 'copy-text', description: '复制文本' }],
    })

    expect(result.paths[0]?.content).toContain('docs/index.md{1,3}-->\n\n<ComponentDocMeta')
    expect(result.paths[0]?.content).toContain('docs/index.md{4,7}-->\n\n## API')
  })

  it('excludes optional source frontmatter from ranged includes', () => {
    const root = createFixtureRoot()
    const sourceDir = resolve(root, 'packages/components/src/CopyText/docs')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(resolve(sourceDir, 'index.md'), '---\ntitle: Copy\n---\n\n# CopyText\n\n复制文本。\n', 'utf8')

    const result = createComponentRoutePaths({
      root,
      components: [{ name: 'CopyText', slug: 'copy-text', description: '复制文本' }],
    })

    expect(result.paths[0]?.content).toContain('docs/index.md{4,7}-->')
    expect(result.paths[0]?.content).not.toContain('docs/index.md{1,')
  })

  it('rejects an API mount inside optional source documentation', () => {
    const root = createFixtureRoot()
    const sourceDir = resolve(root, 'packages/components/src/CopyText/docs')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(resolve(sourceDir, 'index.md'), '# CopyText\n\n<ApiDocs name="CopyText" />\n', 'utf8')

    expect(() => createComponentRoutePaths({
      root,
      components: [{ name: 'CopyText', slug: 'copy-text', description: '复制文本' }],
    })).toThrow('component source documentation must not declare ApiDocs: CopyText')

    writeFileSync(resolve(sourceDir, 'index.md'), '# CopyText\n\n<api-docs name="CopyText" />\n', 'utf8')
    expect(() => createComponentRoutePaths({
      root,
      components: [{ name: 'CopyText', slug: 'copy-text', description: '复制文本' }],
    })).toThrow('component source documentation must not declare ApiDocs: CopyText')
  })

  it('protects the generated overview route', () => {
    const root = createFixtureRoot()

    expect(() => createComponentRoutePaths({
      root,
      components: [{ name: 'CopyText', slug: 'index', description: '复制文本' }],
    })).toThrow('documentation component slug is reserved: index')
  })

  it('rejects duplicate component routes', () => {
    const root = createFixtureRoot()

    expect(() => createComponentRoutePaths({
      root,
      components: [
        { name: 'CopyText', slug: 'copy-text', description: '复制文本' },
        { name: 'CopyButton', slug: 'copy-text', description: '复制按钮' },
      ],
    })).toThrow('duplicate documentation component slugs: copy-text')
  })

  it('rejects unsafe component route identifiers', () => {
    const root = createFixtureRoot()

    expect(() => createComponentRoutePaths({
      root,
      components: [{ name: '../CopyText', slug: 'copy-text', description: '复制文本' }],
    })).toThrow('invalid documentation component name: ../CopyText')
    expect(() => createComponentRoutePaths({
      root,
      components: [{ name: 'CopyText', slug: '../copy-text', description: '复制文本' }],
    })).toThrow('invalid documentation component slug: ../copy-text')
  })
})
