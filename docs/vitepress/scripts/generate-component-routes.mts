import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { docsProject, getLocalizedComponents } from '../.vitepress/catalog/index.ts'
import { docsLocales } from '../.vitepress/site/config/index.ts'
import {
  createComponentRouteLocaleOptions,
  createComponentRoutePaths,
  GENERATED_COMPONENT_ROUTE_MARKER,
  renderGeneratedComponentRoute,
} from './component-routes.mts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const docsRoot = resolve(root, 'docs/vitepress')
export function generateComponentRoutes(
  contentRoot = resolve(
    process.env.ELEMENT_PLUS_DOCS_CONTENT_ROOT ?? resolve(docsRoot, '.generated/content'),
  ),
): number {
  let generatedCount = 0

  for (const locale of Object.keys(docsLocales) as Array<keyof typeof docsLocales>) {
    const configured = docsLocales[locale]
    const outputDirectory = resolve(
      contentRoot,
      configured.sourceDirectory,
      docsProject.documentation.componentsRoute,
    )
    const sourceDocIncludePrefix = `${relative(outputDirectory, root).replaceAll('\\', '/')}/`
    const result = createComponentRoutePaths({
      root,
      components: getLocalizedComponents(locale),
      locale: createComponentRouteLocaleOptions(locale, sourceDocIncludePrefix),
    })
    const generatedNames = new Set(result.paths.map(route => `${route.params.slug}.md`))

    mkdirSync(outputDirectory, { recursive: true })
    for (const route of result.paths) {
      const fileName = `${route.params.slug}.md`
      const outputPath = resolve(outputDirectory, fileName)
      if (existsSync(outputPath)) {
        const existing = readFileSync(outputPath, 'utf8')
        if (!existing.includes(GENERATED_COMPONENT_ROUTE_MARKER))
          throw new Error(`refusing to overwrite unmanaged component route: ${outputPath}`)
      }
      writeFileSync(outputPath, renderGeneratedComponentRoute(route.content), 'utf8')
      generatedCount += 1
    }

    for (const fileName of readdirSync(outputDirectory)) {
      if (fileName === 'index.md' || !fileName.endsWith('.md') || generatedNames.has(fileName))
        continue
      const stalePath = resolve(outputDirectory, fileName)
      if (readFileSync(stalePath, 'utf8').includes(GENERATED_COMPONENT_ROUTE_MARKER))
        unlinkSync(stalePath)
    }
  }

  console.log(`Generated ${generatedCount} searchable component routes.`)
  return generatedCount
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  generateComponentRoutes()
