// @vitest-environment node

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  resolveElementPlusDocsPlaygroundManifest,
  resolveElementPlusDocsProject,
} from '@moluoxixi/vitepress-theme-element-plus'
import {
  collectElementPlusDocsDemos,
  elementPlusDocsProjectMarkdownPlugin,
} from '@moluoxixi/vitepress-theme-element-plus/markdown'
import MarkdownIt from 'markdown-it'
import { afterAll, describe, expect, it } from 'vitest'
import { documentedComponents } from '../../.vitepress/catalog/component-manifest'
import { docsLocales } from '../../.vitepress/site/docs-site'
import projectConfig from '../../element-plus-docs.config.ts'

const workspaceRoot = resolve(import.meta.dirname, '../../../..')
const documentationRoot = resolve(workspaceRoot, 'docs/vitepress')
const temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'element-plus-docs-real-demos-'))
const manifestsPath = resolve(temporaryDirectory, 'playground-manifests.json')

afterAll(() => rmSync(temporaryDirectory, { force: true, recursive: true }))

describe('documentation Demo projects', () => {
  it('projects every component Demo through the latest project Markdown contract', async () => {
    const project = resolveElementPlusDocsProject(projectConfig)
    const componentProfile = project.packages.components!
    const componentManifest = resolveElementPlusDocsPlaygroundManifest(
      componentProfile.name,
      await componentProfile.loadPlaygroundManifest!(),
    )
    writeFileSync(manifestsPath, JSON.stringify({
      packages: { components: componentManifest },
      schemaVersion: 1,
    }))
    const failures: string[] = []

    for (const configured of Object.values(docsLocales)) {
      for (const component of documentedComponents) {
        const sourcePath = resolve(workspaceRoot, component.docsSourcePath, configured.sourceDoc)
        let markdown: string
        try {
          markdown = await readFile(sourcePath, 'utf8')
        }
        catch {
          continue
        }
        const md = new MarkdownIt()
        md.use(elementPlusDocsProjectMarkdownPlugin, {
          dependencyRoot: documentationRoot,
          playgroundManifestsPath: manifestsPath,
          project: projectConfig,
          projectRoot: workspaceRoot,
          providerOverride: 'local',
        })
        const demos = collectElementPlusDocsDemos(md, markdown)
        try {
          const rendered = md.render(markdown, {
            relativePath: [
              configured.pathPrefix.replace(/^\//, ''),
              project.documentation.componentsRoute,
              `${component.slug}.md`,
            ].filter(Boolean).join('/'),
          })
          expect(rendered.match(/external-project-code=/g)?.length ?? 0).toBe(demos.length)
          expect(rendered.match(/external-project-js-code=/g)?.length ?? 0).toBe(demos.length)
        }
        catch (error) {
          failures.push(`${component.name}/${configured.lang}: ${error instanceof Error ? error.message : error}`)
        }
      }
    }

    expect(failures, failures.join('\n')).toEqual([])
  })
})
