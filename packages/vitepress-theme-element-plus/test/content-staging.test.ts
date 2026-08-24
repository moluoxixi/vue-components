// @vitest-environment node

import { EventEmitter } from 'node:events'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import matter from 'gray-matter'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defineComponentPackage,
  defineElementPlusDocsProject,
  resolveElementPlusDocsProject,
} from '../index'
import {
  elementPlusDocsContentRoot,
  synchronizeElementPlusDocsContent,
  watchElementPlusDocsContent,
} from '../src/node/content'

const temporaryDirectories: string[] = []

function createFixture() {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'element-plus-docs-content-'))
  temporaryDirectories.push(projectRoot)
  const docsRoot = resolve(projectRoot, 'docs')
  const generatedRoot = resolve(docsRoot, '.generated')
  mkdirSync(resolve(docsRoot, 'zh/guide'), { recursive: true })
  mkdirSync(resolve(docsRoot, 'en/guide'), { recursive: true })
  mkdirSync(resolve(docsRoot, 'public'), { recursive: true })
  writeFileSync(resolve(docsRoot, 'zh/index.md'), '# 中文首页\n')
  writeFileSync(resolve(docsRoot, 'zh/guide/start.md'), '---\ntitle: 开始\n---\n\n中文正文\n')
  writeFileSync(resolve(docsRoot, 'en/index.md'), '# English home\n')
  writeFileSync(resolve(docsRoot, 'en/guide/start.md'), '# Start\n')
  writeFileSync(resolve(docsRoot, 'public/logo.svg'), '<svg></svg>\n')
  const project = resolveElementPlusDocsProject(defineElementPlusDocsProject({
    components: [],
    documentation: {
      componentsRoute: 'components',
      defaultLocale: 'zh-CN',
      locales: {
        'zh-CN': {
          label: '简体中文',
          pathPrefix: '',
          sourceDirectory: 'zh',
          sourceDoc: 'docs/index.md',
        },
        'en-US': {
          label: 'English',
          pathPrefix: '/en',
          sourceDirectory: 'en',
          sourceDoc: 'docs/index.en.md',
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
    repository: { provider: 'local' },
  }))
  return { docsRoot, generatedRoot, project, projectRoot }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('documentation runtime content staging', () => {
  it('rebuilds symmetric locale content, public assets, and source timestamps', () => {
    const fixture = createFixture()
    const contentRoot = elementPlusDocsContentRoot(fixture.generatedRoot)
    mkdirSync(contentRoot, { recursive: true })
    writeFileSync(resolve(contentRoot, 'stale.md'), '# stale\n')
    const lastUpdated = new Date('2026-08-20T10:20:30.000Z')

    expect(synchronizeElementPlusDocsContent({
      ...fixture,
      resolveLastUpdated: () => lastUpdated,
    })).toBe(contentRoot)

    expect(existsSync(resolve(contentRoot, 'stale.md'))).toBe(false)
    expect(readFileSync(resolve(contentRoot, 'public/logo.svg'), 'utf8')).toBe('<svg></svg>\n')
    expect(matter(readFileSync(resolve(contentRoot, 'zh/index.md'), 'utf8')).data.lastUpdated)
      .toEqual(lastUpdated)
    expect(matter(readFileSync(resolve(contentRoot, 'zh/guide/start.md'), 'utf8')).data)
      .toMatchObject({ lastUpdated, title: '开始' })
    expect(matter(readFileSync(resolve(contentRoot, 'en/index.md'), 'utf8')).data.lastUpdated)
      .toEqual(lastUpdated)
  })

  it('projects source changes and removals through the dev watcher', async () => {
    const fixture = createFixture()
    synchronizeElementPlusDocsContent({
      ...fixture,
      resolveLastUpdated: () => new Date('2026-08-20T10:20:30.000Z'),
    })
    const watcher = Object.assign(new EventEmitter(), {
      add: vi.fn(),
      unwatch: vi.fn(async () => {}),
    })
    const stop = watchElementPlusDocsContent({ watcher } as never, {
      ...fixture,
      resolveLastUpdated: () => new Date('2026-08-21T11:22:33.000Z'),
    })
    const sourcePath = resolve(fixture.docsRoot, 'zh/guide/live.md')
    const destinationPath = resolve(fixture.generatedRoot, 'content/zh/guide/live.md')
    writeFileSync(sourcePath, '# 实时内容\n')

    watcher.emit('add', sourcePath)
    expect(readFileSync(destinationPath, 'utf8')).toContain('# 实时内容')
    expect(matter(readFileSync(destinationPath, 'utf8')).data.lastUpdated)
      .toEqual(new Date('2026-08-21T11:22:33.000Z'))

    watcher.emit('unlink', sourcePath)
    expect(existsSync(destinationPath)).toBe(false)
    stop()
    expect(watcher.unwatch).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(watcher.unwatch).toHaveBeenCalled())
  })

  it('watches public assets created after the dev server starts', () => {
    const fixture = createFixture()
    const publicRoot = resolve(fixture.docsRoot, 'public')
    rmSync(publicRoot, { recursive: true })
    synchronizeElementPlusDocsContent(fixture)
    const watcher = Object.assign(new EventEmitter(), {
      add: vi.fn(),
      unwatch: vi.fn(async () => {}),
    })
    const stop = watchElementPlusDocsContent({ watcher } as never, fixture)
    expect(watcher.add).toHaveBeenCalledWith(expect.arrayContaining([publicRoot]))

    mkdirSync(publicRoot)
    const sourcePath = resolve(publicRoot, 'late.svg')
    const destinationPath = resolve(fixture.generatedRoot, 'content/public/late.svg')
    writeFileSync(sourcePath, '<svg>late</svg>\n')
    watcher.emit('add', sourcePath)

    expect(readFileSync(destinationPath, 'utf8')).toBe('<svg>late</svg>\n')
    stop()
  })

  it('refuses to replace a runtime content root that overlaps author sources', () => {
    const fixture = createFixture()
    const sourceRoot = resolve(fixture.docsRoot, 'content')
    const sourcePath = resolve(sourceRoot, 'index.md')
    mkdirSync(sourceRoot)
    writeFileSync(sourcePath, '# Author source\n')
    const locale = fixture.project.documentation.locales['zh-CN']!
    const unsafeProject = {
      ...fixture.project,
      documentation: {
        ...fixture.project.documentation,
        locales: {
          'zh-CN': { ...locale, sourceDirectory: 'content' },
        },
      },
    }

    expect(() => synchronizeElementPlusDocsContent({
      ...fixture,
      generatedRoot: fixture.docsRoot,
      project: unsafeProject,
    } as never)).toThrow('Documentation content source overlaps the runtime content root')
    expect(readFileSync(sourcePath, 'utf8')).toBe('# Author source\n')
  })

  it('resolves directory aliases before checking destructive path overlap', () => {
    const fixture = createFixture()
    const sourceRoot = resolve(fixture.docsRoot, 'content')
    const sourcePath = resolve(sourceRoot, 'index.md')
    const generatedAlias = resolve(fixture.docsRoot, 'generated-alias')
    mkdirSync(sourceRoot)
    writeFileSync(sourcePath, '# Author source behind alias\n')
    symlinkSync(
      fixture.docsRoot,
      generatedAlias,
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    const locale = fixture.project.documentation.locales['zh-CN']!
    const unsafeProject = {
      ...fixture.project,
      documentation: {
        ...fixture.project.documentation,
        locales: {
          'zh-CN': { ...locale, sourceDirectory: 'content' },
        },
      },
    }

    expect(() => synchronizeElementPlusDocsContent({
      ...fixture,
      generatedRoot: generatedAlias,
      project: unsafeProject,
    } as never)).toThrow('Documentation content source overlaps the runtime content root')
    expect(readFileSync(sourcePath, 'utf8')).toBe('# Author source behind alias\n')
  })

  it('rejects absolute source directories in hand-built project objects', () => {
    const fixture = createFixture()
    const sourcePath = resolve(fixture.docsRoot, 'zh/index.md')
    const locale = fixture.project.documentation.locales['zh-CN']!
    const unsafeProject = {
      ...fixture.project,
      documentation: {
        ...fixture.project.documentation,
        locales: {
          'zh-CN': { ...locale, sourceDirectory: resolve(fixture.docsRoot, 'zh') },
        },
      },
    }

    expect(() => synchronizeElementPlusDocsContent({
      ...fixture,
      project: unsafeProject,
    } as never)).toThrow('Documentation sourceDirectory must be a normalized relative directory')
    expect(readFileSync(sourcePath, 'utf8')).toBe('# 中文首页\n')
  })

  it('revalidates event destinations after runtime subdirectories become aliases', () => {
    const fixture = createFixture()
    synchronizeElementPlusDocsContent(fixture)
    const watcher = Object.assign(new EventEmitter(), {
      add: vi.fn(),
      unwatch: vi.fn(async () => {}),
    })
    const stop = watchElementPlusDocsContent({ watcher } as never, fixture)
    const destinationGuide = resolve(fixture.generatedRoot, 'content/zh/guide')
    const protectedSource = resolve(fixture.docsRoot, 'en/guide/start.md')
    rmSync(destinationGuide, { recursive: true })
    symlinkSync(
      resolve(fixture.docsRoot, 'en/guide'),
      destinationGuide,
      process.platform === 'win32' ? 'junction' : 'dir',
    )

    expect(() => watcher.emit(
      'unlink',
      resolve(fixture.docsRoot, 'zh/guide/start.md'),
    )).toThrow('Documentation runtime destination resolves outside the content root')
    expect(readFileSync(protectedSource, 'utf8')).toBe('# Start\n')
    stop()
  })

  it('rejects a runtime content root aliased outside the docs root', () => {
    const fixture = createFixture()
    const outsideRoot = resolve(fixture.projectRoot, 'outside-runtime')
    const contentRoot = elementPlusDocsContentRoot(fixture.generatedRoot)
    mkdirSync(fixture.generatedRoot, { recursive: true })
    mkdirSync(outsideRoot)
    symlinkSync(
      outsideRoot,
      contentRoot,
      process.platform === 'win32' ? 'junction' : 'dir',
    )

    expect(() => synchronizeElementPlusDocsContent(fixture))
      .toThrow('Documentation content root resolves outside the docs root')
    expect(existsSync(outsideRoot)).toBe(true)
  })

  it('rejects source events that traverse a newly added directory alias', () => {
    const fixture = createFixture()
    synchronizeElementPlusDocsContent(fixture)
    const watcher = Object.assign(new EventEmitter(), {
      add: vi.fn(),
      unwatch: vi.fn(async () => {}),
    })
    const stop = watchElementPlusDocsContent({ watcher } as never, fixture)
    const outsideRoot = resolve(fixture.projectRoot, 'outside-source')
    const outsidePath = resolve(outsideRoot, 'secret.md')
    const sourceAlias = resolve(fixture.docsRoot, 'zh/linked')
    mkdirSync(outsideRoot)
    writeFileSync(outsidePath, '# Secret\n')
    symlinkSync(
      outsideRoot,
      sourceAlias,
      process.platform === 'win32' ? 'junction' : 'dir',
    )

    expect(() => watcher.emit('add', resolve(sourceAlias, 'secret.md')))
      .toThrow('Documentation content event resolves outside its source root')
    expect(existsSync(resolve(fixture.generatedRoot, 'content/zh/linked/secret.md'))).toBe(false)
    stop()
  })

  it('rejects overlapping projections in hand-built project objects', () => {
    const fixture = createFixture()
    const locale = fixture.project.documentation.locales['zh-CN']!
    const unsafeProject = {
      ...fixture.project,
      documentation: {
        ...fixture.project.documentation,
        locales: {
          'zh-CN': locale,
          'duplicate': { ...locale },
        },
      },
    }

    expect(() => synchronizeElementPlusDocsContent({
      ...fixture,
      project: unsafeProject,
    } as never)).toThrow('Documentation content projections must not overlap')
  })
})
