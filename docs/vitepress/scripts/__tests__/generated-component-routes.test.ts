// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { docsProject } from '../../.vitepress/catalog/component-manifest.ts'
import { getLocalizedComponents } from '../../.vitepress/catalog/docs-i18n.ts'
import { docsLocales } from '../../.vitepress/site/docs-site.ts'
import { GENERATED_COMPONENT_ROUTE_MARKER } from '../component-routes.mts'

describe('generated searchable component routes', () => {
  it('materializes every localized component as a VitePress Markdown page', () => {
    const docsRoot = resolve(import.meta.dirname, '../..')

    for (const locale of Object.keys(docsLocales) as Array<keyof typeof docsLocales>) {
      const configured = docsLocales[locale]
      const directory = resolve(
        docsRoot,
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
    const docsRoot = resolve(import.meta.dirname, '../..')
    for (const relativePath of [
      'components/antd-config-form.md',
      'components/element-config-form.md',
      'en/components/antd-config-form.md',
      'en/components/element-config-form.md',
    ]) {
      expect(readFileSync(resolve(docsRoot, relativePath), 'utf8'))
        .toContain('<span hidden data-doc-search-aliases>ConfigForm config form config-form</span>')
    }
  })
})
