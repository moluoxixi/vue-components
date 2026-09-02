import type MarkdownIt from 'markdown-it'
import type { RepositoryMetadataProvider } from '../../content/repository/types'
import type { ElementPlusDocsProject } from '../../project/types'
import type { ElementPlusDocsDemoSourceHrefContext } from '../demo'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { repositoryMetadataProviderSupports } from '../../content/repository/registry'
import { collectElementPlusDocsDemos } from '../demo'

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

export function createElementPlusDocsDemoSourceHrefResolver(
  md: MarkdownIt,
  options: {
    defaultBranch: string
    project: ElementPlusDocsProject
    projectRoot: string
    provider: RepositoryMetadataProvider
    repositoryUrl: string
  },
): (context: ElementPlusDocsDemoSourceHrefContext) => string | undefined {
  let hrefByRouteAndDemo: ReadonlyMap<string, string> | undefined
  const provider = options.provider

  function sourceLinks(): ReadonlyMap<string, string> {
    if (hrefByRouteAndDemo)
      return hrefByRouteAndDemo

    const links = new Map<string, string>()
    for (const configured of Object.values(options.project.documentation.locales)) {
      for (const component of options.project.components.flatMap(group => group.items)) {
        const sourceRelativePath = slash(`${component.docsSourcePath}/${configured.sourceDoc}`)
        const sourcePath = resolve(options.projectRoot, sourceRelativePath)
        if (!existsSync(sourcePath))
          continue

        const routeRelativePath = slash([
          configured.pathPrefix.replace(/^\//, ''),
          options.project.documentation.componentsRoute,
          `${component.slug}.md`,
        ].filter(Boolean).join('/'))
        const markdown = readFileSync(sourcePath, 'utf8')
        for (const demo of collectElementPlusDocsDemos(md, markdown)) {
          if (demo.startLine <= 0 || demo.endLine < demo.startLine)
            continue
          if (!repositoryMetadataProviderSupports(provider, 'sourceLinks'))
            continue
          const href = provider.actions?.sourceLineHref?.({
            defaultBranch: options.defaultBranch,
            endLine: demo.endLine,
            path: sourceRelativePath,
            repositoryUrl: options.repositoryUrl,
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
