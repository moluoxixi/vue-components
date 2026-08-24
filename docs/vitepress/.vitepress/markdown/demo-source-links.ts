import type { ElementPlusDocsDemoSourceHrefContext } from '@moluoxixi/vitepress-theme-element-plus/markdown'
import type MarkdownIt from 'markdown-it'
import type { DocsRepositoryMetadataSelection } from '../repository/selection'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectElementPlusDocsDemos } from '@moluoxixi/vitepress-theme-element-plus/markdown'
import { getLocalizedComponents } from '../catalog/docs-i18n'
import {
  createRepositoryMetadataActionInput,
  repositoryMetadataSelection,
} from '../repository/selection'
import { repositoryMetadataProviderSupports } from '../repository/types'
import { docsLocales } from '../site/docs-site'

interface MarkdownEnvironment {
  relativePath?: string
}

function slash(path: string): string {
  return path.replaceAll('\\', '/')
}

function environmentRelativePath(environment: unknown): string | undefined {
  if (!environment || typeof environment !== 'object')
    return undefined
  const relativePath = (environment as MarkdownEnvironment).relativePath
  return typeof relativePath === 'string' ? slash(relativePath) : undefined
}

export function createDocsDemoSourceHrefResolver(
  md: MarkdownIt,
  root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..'),
  selection: DocsRepositoryMetadataSelection = repositoryMetadataSelection,
): (context: ElementPlusDocsDemoSourceHrefContext) => string | undefined {
  let hrefByRouteAndDemo: ReadonlyMap<string, string> | undefined
  const provider = selection.provider

  function sourceLinks(): ReadonlyMap<string, string> {
    if (hrefByRouteAndDemo)
      return hrefByRouteAndDemo

    const links = new Map<string, string>()
    for (const locale of Object.keys(docsLocales) as Array<keyof typeof docsLocales>) {
      const configured = docsLocales[locale]
      for (const component of getLocalizedComponents(locale)) {
        const sourceRelativePath = slash(`${component.docsSourcePath}/${configured.sourceDoc}`)
        const sourcePath = resolve(root, sourceRelativePath)
        if (!existsSync(sourcePath))
          continue

        const routeRelativePath = slash(`${configured.sourceDirectory}components/${component.slug}.md`)
        const markdown = readFileSync(sourcePath, 'utf8')
        for (const demo of collectElementPlusDocsDemos(md, markdown)) {
          if (demo.startLine <= 0 || demo.endLine < demo.startLine)
            continue
          if (!repositoryMetadataProviderSupports(provider, 'sourceLinks'))
            continue
          const href = provider.actions?.sourceLineHref?.({
            ...createRepositoryMetadataActionInput(selection, component.name),
            endLine: demo.endLine,
            path: sourceRelativePath,
            startLine: demo.startLine,
          })
          if (!href)
            continue
          links.set(`${routeRelativePath}\0${demo.demoId}`, href)
        }
      }
    }

    hrefByRouteAndDemo = links
    return links
  }

  return ({ demoId, environment }) => {
    const relativePath = environmentRelativePath(environment)
    if (!relativePath)
      return undefined
    return sourceLinks().get(`${relativePath}\0${demoId}`)
  }
}
