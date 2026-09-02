// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import MarkdownIt from 'markdown-it'
import { afterEach, describe, expect, it } from 'vitest'
import {
  defineComponentPackage,
  defineElementPlusDocsProject,
  resolveElementPlusDocsProject,
} from '../index'
import { repositoryMetadataProviders } from '../repository'
import {
  collectElementPlusDocsDemos,
  elementPlusDocsDemoPlugin,
} from '../src/markdown/demo'
import { createElementPlusDocsDemoSourceHrefResolver } from '../src/markdown/source'

const temporaryDirectories: string[] = []

function fixture() {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'element-plus-docs-source-links-'))
  temporaryDirectories.push(projectRoot)
  const docsPath = resolve(projectRoot, 'packages/components/src/CopyText/docs/index.md')
  mkdirSync(resolve(docsPath, '..'), { recursive: true })
  const markdown = `# CopyText

Fixture component.

:::demo Basic copy
\`\`\`vue
<template><button>Copy</button></template>
\`\`\`
:::
`
  writeFileSync(docsPath, markdown)
  const project = resolveElementPlusDocsProject(defineElementPlusDocsProject({
    components: [{
      description: 'Fixture components',
      id: 'general',
      items: [{
        description: 'Copies text',
        icon: 'copy',
        name: 'CopyText',
        sidebarText: 'CopyText',
      }],
      title: 'General',
    }],
    documentation: {
      componentsRoute: 'components',
      defaultLocale: 'en-US',
      locales: {
        'en-US': {
          label: 'English',
          pathPrefix: '',
          sourceDirectory: 'content',
          sourceDoc: 'docs/index.md',
        },
      },
    },
    packages: {
      components: defineComponentPackage({
        componentSource: name => `packages/components/src/${name}`,
        load: async () => ({}),
        name: '@fixture/components',
        root: 'packages/components',
      }),
    },
    repository: {
      provider: 'github',
      url: 'https://github.com/fixture/components',
    },
  }))
  const md = new MarkdownIt()
  md.use(elementPlusDocsDemoPlugin)
  return { md, markdown, project, projectRoot }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('project Demo source links', () => {
  it('maps a generated component route to its original Markdown fence lines', () => {
    const { md, markdown, project, projectRoot } = fixture()
    const demo = collectElementPlusDocsDemos(md, markdown)[0]!
    const resolveSourceHref = createElementPlusDocsDemoSourceHrefResolver(md, {
      defaultBranch: 'main',
      project,
      projectRoot,
      provider: repositoryMetadataProviders.get('github'),
      repositoryUrl: 'https://github.com/fixture/components',
    })

    expect(resolveSourceHref({ ...demo, environment: { relativePath: 'components/copy-text.md' } }))
      .toBe(`https://github.com/fixture/components/blob/main/packages/components/src/CopyText/docs/index.md?plain=1#L${demo.startLine}-L${demo.endLine}`)
    expect(resolveSourceHref({ ...demo, environment: { relativePath: 'components/other.md' } }))
      .toBeUndefined()
  })

  it('uses the provider-owned Markdown source route and exact line contract', () => {
    const { md, markdown, project, projectRoot } = fixture()
    const demo = collectElementPlusDocsDemos(md, markdown)[0]!
    const resolveSourceHref = createElementPlusDocsDemoSourceHrefResolver(md, {
      defaultBranch: 'master',
      project,
      projectRoot,
      provider: repositoryMetadataProviders.get('yunxiao'),
      repositoryUrl: 'https://codeup.aliyun.com/fixture/components',
    })

    expect(resolveSourceHref({ ...demo, environment: { relativePath: 'components/copy-text.md' } }))
      .toBe(`https://codeup.aliyun.com/fixture/components/blob/master/packages/components/src/CopyText/docs/index.md?README.md#L${demo.startLine}`)
  })
})
