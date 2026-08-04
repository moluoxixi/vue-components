// @vitest-environment node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  GENERATED_ROUTE_MARKER,
  renderComponentRoute,
  syncComponentRoutes,
} from '../component-routes.mts'

const roots: string[] = []

function createFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'component-doc-routes-'))
  roots.push(root)
  mkdirSync(resolve(root, 'docs/vitepress/components'), { recursive: true })
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
    }, true)

    expect(route).toBe(`${GENERATED_ROUTE_MARKER}\n\n<!--@include: ../../../packages/components/src/CopyText/docs/index.md-->\n\n## API\n\n<ApiDocs name="CopyText" />\n`)
  })

  it('renders a title and description when source documentation is absent', () => {
    const route = renderComponentRoute({
      name: 'CopyText',
      slug: 'copy-text',
      description: '复制文本',
    }, false)

    expect(route).toContain('# CopyText\n\n复制文本')
    expect(route).toMatch(/复制文本[\s\S]*## API[\s\S]*<ApiDocs name="CopyText" \/>/)
  })

  it('creates routes, preserves the overview, and removes only stale generated routes', () => {
    const root = createFixtureRoot()
    const routeDir = resolve(root, 'docs/vitepress/components')
    const sourceDir = resolve(root, 'packages/components/src/CopyText/docs')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(resolve(sourceDir, 'index.md'), '# CopyText\n', 'utf8')
    writeFileSync(resolve(routeDir, 'index.md'), '# Overview\n', 'utf8')
    writeFileSync(resolve(routeDir, 'stale.md'), `${GENERATED_ROUTE_MARKER}\n\n# Stale\n`, 'utf8')

    const result = syncComponentRoutes({
      root,
      routeDir,
      components: [{ name: 'CopyText', slug: 'copy-text', description: '复制文本' }],
    })

    expect(result).toEqual({ generated: ['copy-text.md'], removed: ['stale.md'], apiOnly: [] })
    expect(readFileSync(resolve(routeDir, 'index.md'), 'utf8')).toBe('# Overview\n')
    expect(readFileSync(resolve(routeDir, 'copy-text.md'), 'utf8')).toContain('<!--@include:')
  })

  it('generates an API-only route when docs/index.md does not exist', () => {
    const root = createFixtureRoot()
    const routeDir = resolve(root, 'docs/vitepress/components')

    const result = syncComponentRoutes({
      root,
      routeDir,
      components: [{ name: 'RequestSelectV2', slug: 'request-select-v2', description: '远程选择器' }],
    })

    expect(result.apiOnly).toEqual(['RequestSelectV2'])
    expect(readFileSync(resolve(routeDir, 'request-select-v2.md'), 'utf8'))
      .toContain('# RequestSelectV2\n\n远程选择器\n\n## API')
  })

  it('rejects an API mount inside optional source documentation', () => {
    const root = createFixtureRoot()
    const routeDir = resolve(root, 'docs/vitepress/components')
    const sourceDir = resolve(root, 'packages/components/src/CopyText/docs')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(resolve(sourceDir, 'index.md'), '# CopyText\n\n<ApiDocs name="CopyText" />\n', 'utf8')

    expect(() => syncComponentRoutes({
      root,
      routeDir,
      components: [{ name: 'CopyText', slug: 'copy-text', description: '复制文本' }],
    })).toThrow('component source documentation must not declare ApiDocs: CopyText')

    writeFileSync(resolve(sourceDir, 'index.md'), '# CopyText\n\n<api-docs name="CopyText" />\n', 'utf8')
    expect(() => syncComponentRoutes({
      root,
      routeDir,
      components: [{ name: 'CopyText', slug: 'copy-text', description: '复制文本' }],
    })).toThrow('component source documentation must not declare ApiDocs: CopyText')
  })

  it('protects the handwritten overview route', () => {
    const root = createFixtureRoot()
    const routeDir = resolve(root, 'docs/vitepress/components')
    writeFileSync(resolve(routeDir, 'index.md'), '# Overview\n', 'utf8')

    expect(() => syncComponentRoutes({
      root,
      routeDir,
      components: [{ name: 'CopyText', slug: 'index', description: '复制文本' }],
    })).toThrow('documentation component slug is reserved: index')
    expect(readFileSync(resolve(routeDir, 'index.md'), 'utf8')).toBe('# Overview\n')
  })

  it('rejects non-file Markdown entries before generating routes', () => {
    const root = createFixtureRoot()
    const routeDir = resolve(root, 'docs/vitepress/components')
    mkdirSync(resolve(routeDir, 'copy-text.md'))

    expect(() => syncComponentRoutes({
      root,
      routeDir,
      components: [{ name: 'CopyText', slug: 'copy-text', description: '复制文本' }],
    })).toThrow('documentation routes contain non-file entries: copy-text.md')
  })

  it('does not overwrite an unowned Markdown route', () => {
    const root = createFixtureRoot()
    const routeDir = resolve(root, 'docs/vitepress/components')
    writeFileSync(resolve(routeDir, 'copy-text.md'), '# Handwritten page\n', 'utf8')

    expect(() => syncComponentRoutes({
      root,
      routeDir,
      components: [{ name: 'CopyText', slug: 'copy-text', description: '复制文本' }],
    })).toThrow('documentation routes are not generated files: copy-text.md')
    expect(readFileSync(resolve(routeDir, 'copy-text.md'), 'utf8')).toBe('# Handwritten page\n')
  })
})
