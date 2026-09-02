// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defineComponentPackage,
  defineElementPlusDocsProject,
  resolveElementPlusDocsProject,
} from '../index'
import { createElementPlusDocsExternalProjectSourceResolver } from '../src/markdown/playground'

const componentsManifest = {
  packageName: '@fixture/components',
  imports: {
    '@fixture/components/CopyText': {
      dependencies: {
        '@fixture/components': 'latest',
        'vue': '^3.5.0',
      },
      exports: ['CopyText', 'CopyTextProps'],
      styleImports: ['@fixture/components/styles'],
    },
    '@fixture/components/RequestSelect': {
      dependencies: {
        '@fixture/components': 'latest',
        '@tanstack/vue-query': '^5.0.0',
        'element-plus': '^2.9.0',
        'vue': '^3.5.0',
      },
      exports: ['RequestSelect'],
      styleImports: ['@fixture/components/styles', 'element-plus/dist/index.css'],
    },
  },
} as const

const extraManifest = {
  packageName: '@fixture/extra',
  imports: {
    '@fixture/extra/ExtraWidget': {
      dependencies: { '@fixture/extra': 'latest', 'vue': '^3.5.0' },
      exports: ['ExtraWidget'],
      styleImports: ['@fixture/extra/styles'],
    },
  },
} as const

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

function createProject() {
  return resolveElementPlusDocsProject(defineElementPlusDocsProject({
    components: [],
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
        loadPlaygroundManifest: async () => componentsManifest,
        name: '@fixture/components',
        root: 'packages/components',
        styles: ['@fixture/components/styles'],
      }),
      extra: defineComponentPackage({
        componentSource: name => `packages/extra/src/${name}`,
        load: async () => ({}),
        loadPlaygroundManifest: async () => extraManifest,
        name: '@fixture/extra',
        root: 'packages/extra',
        styles: ['@fixture/extra/styles'],
      }),
      richText: defineComponentPackage({
        componentSource: () => 'packages/rich-text',
        load: async () => ({}),
        name: '@fixture/rich-text',
        root: 'packages/rich-text',
        styles: ['@fixture/rich-text/styles'],
      }),
    },
    repository: { provider: 'local' },
  }))
}

function createResolver(resolvePackageVersion = vi.fn(() => '1.2.3')) {
  const project = createProject()
  const resolveSource = createElementPlusDocsExternalProjectSourceResolver({
    dependencyRoot: process.cwd(),
    playgroundManifests: { components: componentsManifest, extra: extraManifest },
    project,
    resolvePackageVersion,
  })
  return {
    resolvePackageVersion,
    resolveSource(source: string, sourceLanguage: 'JS' | 'TS' = 'TS') {
      return resolveSource({
        code: source,
        demoId: 'fixture-demo',
        endLine: 0,
        environment: {},
        sourceLanguage,
        startLine: 0,
        title: 'Fixture',
      })
    },
  }
}

function createDefaultResolver(dependencyRoot: string) {
  const resolveSource = createElementPlusDocsExternalProjectSourceResolver({
    dependencyRoot,
    playgroundManifests: { components: componentsManifest, extra: extraManifest },
    project: createProject(),
  })
  return (source: string) => resolveSource({
    code: source,
    demoId: 'installed-dependency-demo',
    endLine: 0,
    environment: {},
    sourceLanguage: 'TS',
    startLine: 0,
    title: 'Installed dependency',
  })
}

function createDependencyRoot(
  dependencies: Readonly<Record<string, string>>,
  installed: Readonly<Record<string, { exports?: Readonly<Record<string, string>>, version: string }>>,
): string {
  const root = mkdtempSync(resolve(tmpdir(), 'element-plus-docs-dependencies-'))
  temporaryDirectories.push(root)
  writeFileSync(resolve(root, 'package.json'), JSON.stringify({ dependencies, name: 'fixture-docs', private: true }))
  for (const [name, manifest] of Object.entries(installed)) {
    const packageRoot = resolve(root, 'node_modules', ...name.split('/'))
    mkdirSync(packageRoot, { recursive: true })
    writeFileSync(resolve(packageRoot, 'package.json'), JSON.stringify({
      ...manifest,
      name,
    }))
  }
  return root
}

describe('project external Playground source', () => {
  it('rewrites root imports to the smallest manifest subpath', () => {
    const { resolveSource } = createResolver()
    const result = resolveSource(`<script setup lang="ts">
import { CopyText } from '@fixture/components'
</script>`)

    expect(result.source).toContain(`import { CopyText } from '@fixture/components/CopyText'`)
    expect(result.dependencies).toEqual({
      '@fixture/components': 'latest',
      'vue': '^3.5.0',
    })
    expect(result.styleImports).toEqual(['@fixture/components/styles'])
  })

  it('merges entry-specific peers and styles', () => {
    const { resolveSource } = createResolver()
    const result = resolveSource(`<script setup>
import { RequestSelect } from '@fixture/components'
</script>`)

    expect(result.source).toContain('@fixture/components/RequestSelect')
    expect(result.dependencies).toMatchObject({
      '@tanstack/vue-query': '^5.0.0',
      'element-plus': '^2.9.0',
    })
    expect(result.styleImports).toContain('element-plus/dist/index.css')
  })

  it('supports multiple package manifests in one demo', () => {
    const { resolveSource } = createResolver()
    const result = resolveSource(`<script setup>
import { CopyText } from '@fixture/components'
import { ExtraWidget } from '@fixture/extra'
</script>`)

    expect(result.source).toContain('@fixture/components/CopyText')
    expect(result.source).toContain('@fixture/extra/ExtraWidget')
    expect(result.dependencies).toMatchObject({
      '@fixture/components': 'latest',
      '@fixture/extra': 'latest',
    })
  })

  it('preserves aliases and type-only root imports', () => {
    const { resolveSource } = createResolver()
    const result = resolveSource(`<script setup lang="ts">
import { CopyText, type CopyTextProps, RequestSelect as Select } from '@fixture/components'
</script>`)

    expect(result.source).toContain(`import { CopyText } from '@fixture/components/CopyText'`)
    expect(result.source).toContain(`import { RequestSelect as Select } from '@fixture/components/RequestSelect'`)
    expect(result.source).toContain(`import type { CopyTextProps } from '@fixture/components'`)
  })

  it('resolves direct dependencies from the consumer project and applies profile styles', () => {
    const resolvePackageVersion = vi.fn(() => '2.4.6')
    const { resolveSource } = createResolver(resolvePackageVersion)
    const result = resolveSource(`<script setup>
import { RichText } from '@fixture/rich-text'
import { ElButton } from 'element-plus'
</script>`)

    expect(result.dependencies).toEqual({
      '@fixture/rich-text': '2.4.6',
      'element-plus': '2.4.6',
    })
    expect(result.styleImports).toEqual([
      '@fixture/rich-text/styles',
      'element-plus/dist/index.css',
    ])
    expect(resolvePackageVersion).toHaveBeenCalledWith('@fixture/rich-text', 'fixture-demo')
  })

  it('uses installed exact versions when package.json is private but runtime entries are exported', () => {
    const dependencyRoot = createDependencyRoot({
      '@fixture/rich-text': 'workspace:*',
      'element-plus': 'catalog:',
    }, {
      '@fixture/rich-text': {
        exports: { '.': './index.js' },
        version: '2.4.6',
      },
      'element-plus': {
        exports: { '.': './index.js' },
        version: '2.9.3',
      },
    })
    const resolveSource = createDefaultResolver(dependencyRoot)

    expect(resolveSource(`<script setup>
import { RichText } from '@fixture/rich-text'
import { ElButton } from 'element-plus'
</script>`).dependencies).toEqual({
      '@fixture/rich-text': '2.4.6',
      'element-plus': '2.9.3',
    })
  })

  it('rejects package roots and subpaths that are absent from package exports', () => {
    const dependencyRoot = createDependencyRoot({
      '@fixture/rich-text': 'workspace:*',
    }, {
      '@fixture/rich-text': {
        exports: { './widget': './widget.js' },
        version: '2.4.6',
      },
    })
    const resolveSource = createDefaultResolver(dependencyRoot)

    expect(() => resolveSource(`<script setup>
import { RichText } from '@fixture/rich-text'
</script>`)).toThrow(
      'External playground import "@fixture/rich-text" in installed-dependency-demo is not exported',
    )
    expect(() => resolveSource(`<script setup>
import { RichText } from '@fixture/rich-text/private'
</script>`)).toThrow(
      'External playground import "@fixture/rich-text/private" in installed-dependency-demo is not exported',
    )
  })

  it('rejects an installed dependency that the documentation package does not declare', () => {
    const dependencyRoot = createDependencyRoot({}, {
      '@fixture/rich-text': { version: '2.4.6' },
    })
    const resolveSource = createDefaultResolver(dependencyRoot)

    expect(() => resolveSource(`<script setup>
import { RichText } from '@fixture/rich-text'
</script>`)).toThrow(
      'External playground dependency "@fixture/rich-text" in installed-dependency-demo is not declared by the documentation package.',
    )
  })

  it('reports a stable error when a declared dependency is not installed', () => {
    const dependencyRoot = createDependencyRoot({
      '@fixture/rich-text': 'workspace:*',
    }, {})
    const resolveSource = createDefaultResolver(dependencyRoot)

    expect(() => resolveSource(`<script setup>
import { RichText } from '@fixture/rich-text'
</script>`)).toThrow(
      'Cannot resolve external playground dependency "@fixture/rich-text" in installed-dependency-demo.',
    )
  })

  it('rejects runtime exports and subpaths absent from a configured manifest', () => {
    const { resolveSource } = createResolver()
    expect(() => resolveSource(`<script setup>
import { MissingRuntime } from '@fixture/components'
</script>`)).toThrow('Missing component playground metadata for runtime export "MissingRuntime"')
    expect(() => resolveSource(`<script setup>
import { MissingRuntime } from '@fixture/components/MissingRuntime'
</script>`)).toThrow('Missing component playground metadata for subpath "@fixture/components/MissingRuntime"')
  })
})
