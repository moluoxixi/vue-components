// @vitest-environment node
import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { synchronizeElementPlusDocsContent } from '@moluoxixi/vitepress-theme-element-plus/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { docsProject, getLocalizedComponents, getLocalizedUtilities } from '../../.vitepress/catalog'
import { docsLocales } from '../../.vitepress/site/config'
import { GENERATED_COMPONENT_ROUTE_MARKER } from '../component-routes.mts'
import { generateComponentRoutes } from '../generate-component-routes.mts'
import {
  GENERATED_UTILITY_ROUTE_MARKER,
  generateUtilityRoutes,
} from '../generate-utility-routes.mts'

const projectRoot = resolve(import.meta.dirname, '../../../..')
const docsRoot = resolve(projectRoot, 'docs/vitepress')
const generatedRoot = resolve(docsRoot, '.generated')
const contentRoot = resolve(generatedRoot, 'content')

beforeAll(async () => {
  synchronizeElementPlusDocsContent({
    docsRoot,
    generatedRoot,
    project: docsProject,
    projectRoot,
  })
  generateComponentRoutes(contentRoot)
  generateUtilityRoutes(contentRoot)
})

afterAll(() => {
  rmSync(contentRoot, { force: true, recursive: true })
})

describe('generated searchable component routes', () => {
  it('materializes every localized component as a VitePress Markdown page', () => {
    for (const locale of Object.keys(docsLocales) as Array<keyof typeof docsLocales>) {
      const configured = docsLocales[locale]
      const directory = resolve(
        contentRoot,
        configured.sourceDirectory,
        docsProject.documentation.componentsRoute,
      )
      const expected = getLocalizedComponents(locale).map(component => `${component.slug}.md`).sort()
      const actual = readdirSync(directory)
        .filter(fileName => fileName !== 'index.md' && fileName.endsWith('.md'))
        .sort()
      expect(actual).toEqual(expected)

      for (const fileName of actual) {
        expect(readFileSync(resolve(directory, fileName), 'utf8'))
          .toContain(GENERATED_COMPONENT_ROUTE_MARKER)
      }
    }
  })

  it('includes the ConfigForm family alias in both adapter routes', () => {
    for (const relativePath of [
      'zh/components/antd-config-form.md',
      'zh/components/element-config-form.md',
      'en/components/antd-config-form.md',
      'en/components/element-config-form.md',
    ]) {
      expect(readFileSync(resolve(contentRoot, relativePath), 'utf8'))
        .toContain('<span hidden data-doc-search-aliases>ConfigForm config form config-form</span>')
    }
  })

  it('materializes every localized utility inside the runtime content tree', () => {
    for (const locale of Object.keys(docsLocales) as Array<keyof typeof docsLocales>) {
      const configured = docsLocales[locale]
      const directory = resolve(contentRoot, configured.sourceDirectory, 'utils')
      const generated = readdirSync(directory)
        .filter(fileName => fileName !== 'index.md' && fileName.endsWith('.md'))
      const expectedCount = getLocalizedUtilities(locale).length
      expect(generated).toHaveLength(expectedCount)
      for (const fileName of generated) {
        const source = readFileSync(resolve(directory, fileName), 'utf8')
        expect(source).toContain(GENERATED_UTILITY_ROUTE_MARKER)
        expect(source).toContain('lastUpdated: false')
      }
    }
  })
})
