import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validatePackageArchitectureManifest } from '../package-architecture/config/index.mjs'
import { runPackageArchitectureCli, verifyPackageArchitecture } from '../package-architecture/index.mjs'
import {
  collectComponentOwnershipDiagnostics,
  collectComposableOwnershipDiagnostics,
  collectFeatureImportDiagnostics,
  collectFeatureStructureDiagnostics,
  collectPackageEntryDiagnostics,
  collectPackageInventory,
  parseModule,
  reconcilePackageArchitectureDiagnostics,
} from '../package-architecture/services/index.mjs'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const fixtureRoots = []

function createFixture(files, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'package-architecture-'))
  fixtureRoots.push(root)
  const sources = {
    'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
    ...files,
  }
  if (options.packageReadmes !== false) {
    for (const path of Object.keys(sources).filter(path => path.endsWith('/package.json'))) {
      const readmePath = path.replace(/package\.json$/u, 'README.md')
      if (!(readmePath in sources))
        sources[readmePath] = '# Fixture package\n'
    }
  }
  for (const [path, source] of Object.entries(sources)) {
    const target = resolve(root, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, source)
  }
  return root
}

function packageManifest(name, additions = {}) {
  return JSON.stringify({
    name,
    type: 'module',
    main: './dist/index.js',
    module: './dist/index.js',
    types: './dist/index.d.ts',
    exports: { '.': { source: './index.ts', types: './dist/index.d.ts', import: './dist/index.js' } },
    files: ['dist', 'index.ts', 'src'],
    sideEffects: false,
    scripts: { build: 'vite build' },
    ...additions,
  })
}

afterEach(() => {
  fixtureRoots.splice(0).forEach(root => rmSync(root, { force: true, recursive: true }))
})

describe('package architecture collector', () => {
  it('discovers nested packages without entering package-owned fixtures unless explicitly configured', () => {
    const root = createFixture({
      'pnpm-workspace.yaml': [
        'packages:',
        '  - packages/*',
        '  - packages/parent/fixtures/consumer',
        '',
      ].join('\n'),
      'packages/nested/group/package.json': packageManifest('@fixture/nested'),
      'packages/parent/package.json': packageManifest('@fixture/parent'),
      'packages/parent/child/package.json': packageManifest('@fixture/child'),
      'packages/parent/__tests__/fixtures/ignored/package.json': packageManifest('@fixture/ignored'),
      'packages/parent/fixtures/consumer/package.json': packageManifest('@fixture/consumer'),
      'packages/group/fixtures/unlisted/package.json': packageManifest('@fixture/unlisted'),
      'packages/cache/ignored/package.json': packageManifest('@fixture/cache'),
      'packages/third-party/ignored/package.json': packageManifest('@fixture/third-party'),
    })

    expect(collectPackageInventory(root).map(pkg => pkg.relativeRoot)).toEqual([
      'packages/nested/group',
      'packages/parent',
      'packages/parent/child',
      'packages/parent/fixtures/consumer',
    ])
  })

  it('enforces one explicit package-root source entry', () => {
    const root = createFixture({
      'packages/good/package.json': packageManifest('@fixture/good'),
      'packages/good/index.ts': 'export * from \'./src/feature\'\n',
      'packages/good/src/feature/index.ts': 'export { value } from \'./services\'\n',
      'packages/good/src/feature/services/index.ts': 'export const value = 1\n',
      'packages/bad/package.json': packageManifest('@fixture/bad', {
        exports: {},
        scripts: { build: 'tsup src/index' },
      }),
      'packages/bad/src/index.ts': 'export const value = 1\n',
      'packages/vite-bad/package.json': packageManifest('@fixture/vite-bad'),
      'packages/vite-bad/index.ts': 'export * from \'./src/feature\'\n',
      'packages/vite-bad/src/feature/index.ts': 'export const value = 1\n',
      'packages/vite-bad/vite.config.ts': 'export default { build: { rollupOptions: { input: \'./src/index\' } } }\n',
      'packages/output-bad/package.json': packageManifest('@fixture/output-bad', {
        module: './dist/other.js',
      }),
      'packages/output-bad/index.ts': 'export * from \'./src/feature\'\n',
      'packages/output-bad/src/feature/index.ts': 'export const value = 1\n',
    })
    const packages = collectPackageInventory(root)
    const diagnostics = collectPackageEntryDiagnostics(root, packages)

    expect(diagnostics.filter(item => item.package === 'packages/good')).toEqual([])
    expect(diagnostics.filter(item => item.package === 'packages/bad').map(item => item.rule).sort()).toEqual([
      'package.build-entry',
      'package.output-entry',
      'package.root-index-required',
      'package.source-entry',
      'package.src-index-forbidden',
    ])
    expect(diagnostics.filter(item => item.package === 'packages/vite-bad')).toEqual([
      expect.objectContaining({
        path: 'packages/vite-bad/vite.config.ts',
        rule: 'package.build-entry',
      }),
    ])
    expect(diagnostics.filter(item => item.package === 'packages/output-bad')).toEqual([
      expect.objectContaining({ rule: 'package.output-entry' }),
    ])
  })

  it('enforces published source files, README, and explicit side effects', () => {
    const packageFiles = path => ({
      [`${path}/index.ts`]: 'export { value } from \'./src/feature\'\n',
      [`${path}/src/feature/index.ts`]: 'export const value = 1\n',
    })
    const root = createFixture({
      'packages/good/package.json': packageManifest('@fixture/good'),
      ...packageFiles('packages/good'),
      'packages/good/README.md': '# Good\n',
      'packages/missing-index-source/package.json': packageManifest('@fixture/missing-index-source', {
        files: ['dist', 'src'],
      }),
      ...packageFiles('packages/missing-index-source'),
      'packages/missing-index-source/README.md': '# Missing index source\n',
      'packages/missing-src/package.json': packageManifest('@fixture/missing-src', {
        files: ['dist', 'index.ts'],
      }),
      ...packageFiles('packages/missing-src'),
      'packages/missing-src/README.md': '# Missing src\n',
      'packages/missing-readme/package.json': packageManifest('@fixture/missing-readme'),
      ...packageFiles('packages/missing-readme'),
      'packages/missing-side-effects/package.json': packageManifest('@fixture/missing-side-effects', {
        sideEffects: undefined,
      }),
      ...packageFiles('packages/missing-side-effects'),
      'packages/missing-side-effects/README.md': '# Missing side effects\n',
      'packages/invalid-side-effects/package.json': packageManifest('@fixture/invalid-side-effects', {
        sideEffects: [''],
      }),
      ...packageFiles('packages/invalid-side-effects'),
      'packages/invalid-side-effects/README.md': '# Invalid side effects\n',
      'packages/private/package.json': packageManifest('@fixture/private', {
        files: undefined,
        private: true,
        sideEffects: undefined,
      }),
      ...packageFiles('packages/private'),
    }, { packageReadmes: false })
    const diagnostics = collectPackageEntryDiagnostics(root, collectPackageInventory(root))
    const publicationRules = new Set([
      'package.readme-required',
      'package.side-effects-explicit',
      'package.source-files',
    ])
    const rulesFor = packagePath => diagnostics
      .filter(item => item.package === packagePath && publicationRules.has(item.rule))
      .map(item => item.rule)

    expect(rulesFor('packages/good')).toEqual([])
    expect(rulesFor('packages/missing-index-source')).toEqual(['package.source-files'])
    expect(rulesFor('packages/missing-src')).toEqual(['package.source-files'])
    expect(rulesFor('packages/missing-readme')).toEqual(['package.readme-required'])
    expect(rulesFor('packages/missing-side-effects')).toEqual(['package.side-effects-explicit'])
    expect(rulesFor('packages/invalid-side-effects')).toEqual(['package.side-effects-explicit'])
    expect(rulesFor('packages/private')).toEqual([])
  })

  it('keeps barrels declarative and ignores type-only dependencies', () => {
    const root = createFixture({
      'packages/ui/package.json': packageManifest('@fixture/ui'),
      'packages/ui/index.ts': 'export { type PublicType } from \'./src\'\nexport * from \'./src/feature\'\n',
      'packages/ui/src/index.ts': 'export interface PublicType { value: string }\n',
      'packages/ui/src/feature/index.ts': 'import \'./register-side-effects\'\nexport { value } from \'./services\'\n',
      'packages/ui/src/feature/register-side-effects.ts': 'globalThis.console.log(\'registered\')\n',
      'packages/ui/src/feature/services/index.ts': 'export const value = 1\n',
      'packages/ui/src/types/index.ts': 'import type { PublicType } from \'../../index\'\nexport { type PublicType }\n',
    })
    const [pkg] = collectPackageInventory(root)
    const entryRules = collectPackageEntryDiagnostics(root, [pkg]).map(item => item.rule)
    const featureDiagnostics = collectFeatureStructureDiagnostics(root, [pkg])

    expect(entryRules).not.toContain('package.root-index-explicit-exports')
    expect(parseModule(resolve(root, 'packages/ui/src/types/index.ts')).barrel).toBe(true)
    expect(featureDiagnostics).toContainEqual(expect.objectContaining({
      path: 'packages/ui/src/feature/index.ts',
      rule: 'feature.index-barrel-only',
    }))
  })

  it('rejects cross-feature implementation imports but allows public and parent boundaries', () => {
    const root = createFixture({
      'packages/ui/package.json': packageManifest('@fixture/ui'),
      'packages/ui/index.ts': 'export * from \'./src/features/feature-a\'\nexport * from \'./src/features/feature-b\'\n',
      'packages/ui/src/features/feature-a/index.ts': 'export * from \'./services\'\n',
      'packages/ui/src/features/feature-a/services/index.ts': 'export * from \'./ancestor-shared\'\nexport * from \'./consumer\'\n',
      'packages/ui/src/features/feature-a/services/consumer.ts': [
        'import { publicValue } from \'../../feature-b\'',
        'import { privateValue } from \'../../feature-b/services/private\'',
        'const lazyValue = import(\'../../feature-b/services/lazy\')',
        'import { localValue } from \'./local\'',
        'import { sharedValue } from \'../../../services/shared\'',
        'export { lazyValue, localValue, privateValue, publicValue, sharedValue }',
        '',
      ].join('\n'),
      'packages/ui/src/features/feature-a/child/index.ts': 'export * from \'./services\'\n',
      'packages/ui/src/features/feature-a/child/services/index.ts': 'export * from \'./consumer\'\n',
      'packages/ui/src/features/feature-a/child/services/consumer.ts': [
        'import { ancestorShared } from \'../../services\'',
        'import { ancestorPrivate } from \'../../services/ancestor-private\'',
        'import { invalidAncestorEntry } from \'../../defaults\'',
        'export { ancestorPrivate, ancestorShared, invalidAncestorEntry }',
        '',
      ].join('\n'),
      'packages/ui/src/features/feature-a/defaults/index.ts': 'export const invalidAncestorEntry = true\n',
      'packages/ui/src/features/feature-a/services/ancestor-shared.ts': 'export const ancestorShared = true\n',
      'packages/ui/src/features/feature-a/services/ancestor-private.ts': 'export const ancestorPrivate = true\n',
      'packages/ui/src/features/feature-a/services/local.ts': 'export const localValue = 0\n',
      'packages/ui/src/features/feature-b/index.ts': 'export { publicValue } from \'./services\'\n',
      'packages/ui/src/features/feature-b/services/index.ts': 'export const publicValue = 1\n',
      'packages/ui/src/features/feature-b/services/private.ts': 'export const privateValue = 2\n',
      'packages/ui/src/features/feature-b/services/lazy.ts': 'export const lazyValue = 3\n',
      'packages/ui/src/features/feature-c/services/consumer.ts': 'export { privateValue } from \'../../feature-b/services/private\'\n',
      'packages/ui/src/features/services/worker.ts': 'export const worker = true\n',
      'packages/ui/src/services/shared.ts': 'export const sharedValue = 4\n',
    })
    const packages = collectPackageInventory(root)
    const diagnostics = collectFeatureImportDiagnostics(root, packages)

    expect(diagnostics).toHaveLength(5)
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rule: 'feature.cross-feature-deep-import',
        path: 'packages/ui/src/features/feature-a/services/consumer.ts',
        owners: ['packages/ui/src/features/feature-b/services/private.ts'],
      }),
      expect.objectContaining({
        rule: 'feature.cross-feature-deep-import',
        path: 'packages/ui/src/features/feature-a/services/consumer.ts',
        owners: ['packages/ui/src/features/feature-b/services/lazy.ts'],
      }),
      expect.objectContaining({
        rule: 'feature.cross-feature-deep-import',
        path: 'packages/ui/src/features/feature-a/child/services/consumer.ts',
        owners: ['packages/ui/src/features/feature-a/services/ancestor-private.ts'],
      }),
      expect.objectContaining({
        rule: 'feature.cross-feature-deep-import',
        path: 'packages/ui/src/features/feature-a/child/services/consumer.ts',
        owners: ['packages/ui/src/features/feature-a/defaults/index.ts'],
      }),
      expect.objectContaining({
        rule: 'feature.cross-feature-deep-import',
        path: 'packages/ui/src/features/feature-c/services/consumer.ts',
        owners: ['packages/ui/src/features/feature-b/services/private.ts'],
      }),
    ]))
    expect(collectFeatureStructureDiagnostics(root, packages)).toContainEqual(expect.objectContaining({
      rule: 'feature.index-required',
      path: 'packages/ui/src/features/feature-c/index.ts',
    }))
    expect(collectFeatureStructureDiagnostics(root, packages)).toContainEqual(expect.objectContaining({
      rule: 'feature.index-required',
      path: 'packages/ui/src/features/services/index.ts',
    }))
  })

  it('requires exported composables to own Vue state while following local wrappers', () => {
    const root = createFixture({
      'packages/ui/package.json': packageManifest('@fixture/ui'),
      'packages/ui/index.ts': 'export * from \'./src/composables\'\n',
      'packages/ui/src/composables/index.ts': 'export * from \'./reactive\'\nexport * from \'./pure\'\nexport * from \'./wrapper\'\n',
      'packages/ui/src/composables/reactive.ts': [
        'import { computed as makeComputed } from \'vue\'',
        'export function useReactive() { return makeComputed(() => 1) }',
        '',
      ].join('\n'),
      'packages/ui/src/composables/namespace.ts': [
        'import * as Vue from \'vue\'',
        'export function useNamespaceReactive() { return Vue.inject(\'value\') }',
        '',
      ].join('\n'),
      'packages/ui/src/composables/wrapper.ts': [
        'import { useNamespaceReactive } from \'./namespace\'',
        'export function useWrapper() { return useNamespaceReactive() }',
        '',
      ].join('\n'),
      'packages/ui/src/composables/bridge/index.ts': 'export { useNamespaceReactive } from \'../namespace\'\n',
      'packages/ui/src/composables/barrel-wrapper.ts': [
        'import { useNamespaceReactive } from \'./bridge\'',
        'export function useBarrelWrapper() { return useNamespaceReactive() }',
        '',
      ].join('\n'),
      'packages/ui/src/composables/pure.ts': [
        'import type { ComputedRef } from \'vue\'',
        'import { toRaw } from \'vue\'',
        'const useListedPure = () => 1',
        'export function usePure(value: ComputedRef<string>) { return value.value }',
        'export function useOnlyToRaw(value: object) { return toRaw(value) }',
        'export { useListedPure }',
        '',
      ].join('\n'),
      'packages/ui/src/composables/nested/services/validation.ts': 'export function useServiceOnly() { return 1 }\n',
    })
    const diagnostics = collectComposableOwnershipDiagnostics(root, collectPackageInventory(root))

    expect(diagnostics).toEqual([
      expect.objectContaining({
        rule: 'composable.vue-ownership-required',
        path: 'packages/ui/src/composables/pure.ts',
        message: expect.stringContaining('useListedPure, useOnlyToRaw, usePure'),
      }),
    ])
  })

  it('distinguishes public re-exports from private imports and resolves barrels and import()', () => {
    const root = createFixture({
      'packages/ui/package.json': packageManifest('@fixture/ui'),
      'packages/ui/index.ts': 'import PublicView from \'./src/PublicView.vue\'\nexport { PublicView }\nexport { default as PublicShared } from \'./src/components/PublicShared.vue\'\nexport * from \'./src/feature-a\'\nexport * from \'./src/feature-b\'\n',
      'packages/ui/src/PublicView.vue': '<template><div /></template>\n',
      'packages/ui/src/feature-a/index.ts': 'export { default as FeatureA } from \'./index.vue\'\n',
      'packages/ui/src/feature-a/index.vue': `<script setup lang="ts">\nimport CorrectChild from './components/CorrectChild.vue'\nimport NestedParent from './components/NestedParent.vue'\nimport SecondOwner from './components/SecondOwner.vue'\nimport MisplacedChild from '../components/MisplacedChild.vue'\nimport OneFeatureShared from '../components/OneFeatureShared.vue'\nimport Shared from '../components/Shared.vue'\nconst LazyChild = () => import('./components/LazyChild.vue')\nvoid [CorrectChild, NestedParent, SecondOwner, MisplacedChild, OneFeatureShared, Shared, LazyChild]\n</script>`,
      'packages/ui/src/feature-a/components/CorrectChild.vue': '<template><div /></template>\n',
      'packages/ui/src/feature-a/components/LazyChild.vue': '<template><div /></template>\n',
      'packages/ui/src/feature-a/components/NestedParent.vue': `<script setup lang="ts">\nimport NestedChild from './NestedParent/components/NestedChild.vue'\nvoid NestedChild\n</script>`,
      'packages/ui/src/feature-a/components/SecondOwner.vue': `<script setup lang="ts">\nimport OneFeatureShared from '../../components/OneFeatureShared.vue'\nvoid OneFeatureShared\n</script>`,
      'packages/ui/src/feature-a/components/NestedParent/components/NestedChild.vue': '<template><div /></template>\n',
      'packages/ui/src/feature-b/index.ts': 'export { default as FeatureB } from \'./index.vue\'\n',
      'packages/ui/src/feature-b/index.vue': `<script setup lang="ts">\nimport Shared from '../components/Shared.vue'\nvoid Shared\n</script>`,
      'packages/ui/src/components/MisplacedChild.vue': '<template><div /></template>\n',
      'packages/ui/src/components/OneFeatureShared.vue': '<template><div /></template>\n',
      'packages/ui/src/components/PublicShared.vue': '<template><div /></template>\n',
      'packages/ui/src/components/Shared.vue': '<template><div /></template>\n',
    })
    const packages = collectPackageInventory(root)
    const diagnostics = collectComponentOwnershipDiagnostics(root, packages)

    expect(diagnostics).toEqual([
      expect.objectContaining({
        rule: 'component.single-parent-location',
        path: 'packages/ui/src/components/MisplacedChild.vue',
        owners: ['packages/ui/src/feature-a/index.vue'],
      }),
      expect.objectContaining({
        rule: 'component.shared-feature-owners',
        path: 'packages/ui/src/components/OneFeatureShared.vue',
        owners: [
          'packages/ui/src/feature-a/components/SecondOwner.vue',
          'packages/ui/src/feature-a/index.vue',
        ],
      }),
    ])
  })

  it('rejects unknown diagnostics and stale debt or exceptions', () => {
    const diagnostics = [
      { rule: 'package.root-index-required', path: 'packages/a/index.ts', package: 'packages/a', message: 'missing' },
      { rule: 'component.owner-required', path: 'packages/a/src/App.vue', package: 'packages/a', message: 'owner' },
      { rule: 'component.owner-required', path: 'packages/a/src/Unknown.vue', package: 'packages/a', message: 'unknown' },
      { rule: 'feature.root-file', path: 'packages/a/src/upstream/file.ts', package: 'packages/a', message: 'vendored' },
    ]
    const manifest = {
      version: 1,
      packageExceptions: [{
        package: 'packages/a',
        kind: 'private-app',
        rules: ['package.root-index-required'],
        reason: 'fixture',
      }],
      pathExceptions: [{
        path: 'packages/a/src/upstream',
        kind: 'third-party',
        reason: 'fixture',
      }],
      componentExceptions: [{
        component: 'packages/a/src/App.vue',
        kind: 'framework',
        rules: ['component.owner-required'],
        owners: ['packages/a/src/main.ts'],
        reason: 'fixture',
      }],
      importExceptions: [],
      debt: [{
        rule: 'feature.root-file',
        path: 'packages/a/src/old.ts',
        targetTask: 'fixture-cleanup',
        reason: 'fixture',
      }],
    }
    const result = reconcilePackageArchitectureDiagnostics(diagnostics, manifest)

    expect(result.unknown).toEqual([diagnostics[2]])
    expect(result.staleDebt).toEqual(manifest.debt)
    expect(result.staleExceptions).toEqual([])
  })

  it('requires exact component rules and static owners for exceptions', () => {
    const diagnostic = {
      rule: 'component.single-feature-location',
      path: 'packages/a/src/App.vue',
      package: 'packages/a',
      owners: ['packages/a/src/main.ts'],
      message: 'misplaced',
    }
    const manifest = {
      version: 1,
      packageExceptions: [],
      pathExceptions: [],
      componentExceptions: [{
        component: diagnostic.path,
        kind: 'framework',
        rules: [diagnostic.rule],
        owners: ['packages/a/scripts/build.mjs'],
        reason: 'fixture',
      }],
      importExceptions: [],
      debt: [],
    }

    const result = reconcilePackageArchitectureDiagnostics([diagnostic], manifest)
    expect(result.unknown).toEqual([diagnostic])
    expect(result.staleExceptions).toEqual([expect.objectContaining({
      path: diagnostic.path,
      rule: diagnostic.rule,
    })])
  })

  it('requires feature import exceptions to match one exact importer and target', () => {
    const root = createFixture({
      'packages/a/src/feature-a/consumer.ts': 'export const consumer = true\n',
      'packages/a/src/feature-b/other.ts': 'export const other = true\n',
      'packages/a/src/feature-b/private.ts': 'export const value = true\n',
    })
    const diagnostic = {
      rule: 'feature.cross-feature-deep-import',
      path: 'packages/a/src/feature-a/consumer.ts',
      package: 'packages/a',
      owners: ['packages/a/src/feature-b/private.ts'],
      message: 'deep import',
    }
    const importException = {
      importer: diagnostic.path,
      target: diagnostic.owners[0],
      kind: 'lazy',
      rule: diagnostic.rule,
      reason: 'Preserves a lazy boundary.',
    }
    const manifest = {
      version: 1,
      packageExceptions: [],
      pathExceptions: [],
      componentExceptions: [],
      importExceptions: [importException],
      debt: [],
    }

    expect(validatePackageArchitectureManifest(manifest, root)).toBe(manifest)
    expect(reconcilePackageArchitectureDiagnostics([diagnostic], manifest)).toMatchObject({
      staleExceptions: [],
      unknown: [],
    })

    const wrongTargetManifest = {
      ...manifest,
      importExceptions: [{
        ...importException,
        target: 'packages/a/src/feature-b/other.ts',
      }],
    }
    expect(reconcilePackageArchitectureDiagnostics([diagnostic], wrongTargetManifest)).toMatchObject({
      staleExceptions: [expect.objectContaining({
        owners: ['packages/a/src/feature-b/other.ts'],
        path: diagnostic.path,
        rule: diagnostic.rule,
      })],
      unknown: [diagnostic],
    })
    expect(() => validatePackageArchitectureManifest({
      ...manifest,
      importExceptions: [{ ...importException, target: 'packages/a/src/missing.ts' }],
    }, root)).toThrow(/points to missing path/u)
  })

  it('accepts existing declared owners when static analysis cannot resolve an owner', () => {
    const root = createFixture({
      'packages/a/package.json': packageManifest('@fixture/a'),
      'packages/a/src/Private.vue': '<template><div /></template>\n',
      'packages/a/src/main.ts': 'export const applicationEntry = true\n',
    })
    const diagnostic = {
      rule: 'component.owner-required',
      path: 'packages/a/src/Private.vue',
      package: 'packages/a',
      message: 'owner',
    }
    const componentException = {
      component: diagnostic.path,
      kind: 'dynamic',
      rules: [diagnostic.rule],
      owners: ['packages/a/src/main.ts'],
      reason: 'Resolved by framework registration.',
    }
    const manifest = {
      version: 1,
      packageExceptions: [],
      pathExceptions: [],
      componentExceptions: [componentException],
      importExceptions: [],
      debt: [],
    }

    expect(validatePackageArchitectureManifest(manifest, root)).toBe(manifest)
    expect(reconcilePackageArchitectureDiagnostics([diagnostic], manifest)).toMatchObject({
      staleExceptions: [],
      unknown: [],
    })
    expect(() => validatePackageArchitectureManifest({
      ...manifest,
      componentExceptions: [{
        ...componentException,
        owners: ['packages/a/src/missing.ts'],
      }],
    }, root)).toThrow(/points to missing path/u)
  })

  it('rejects invalid exception kinds and duplicate debt identities', () => {
    const baseManifest = {
      version: 1,
      packageExceptions: [],
      pathExceptions: [],
      componentExceptions: [],
      importExceptions: [],
      debt: [],
    }
    expect(() => validatePackageArchitectureManifest({
      ...baseManifest,
      pathExceptions: [{ path: 'packages/vendor', kind: 'other', reason: 'fixture' }],
    })).toThrow(/unsupported value/u)
    const importException = {
      importer: 'packages/a/src/feature-a/index.ts',
      target: 'packages/a/src/feature-b/private.ts',
      kind: 'lazy',
      rule: 'feature.cross-feature-deep-import',
      reason: 'fixture',
    }
    expect(() => validatePackageArchitectureManifest({
      ...baseManifest,
      importExceptions: [{ ...importException, kind: 'other' }],
    })).toThrow(/unsupported value/u)
    expect(() => validatePackageArchitectureManifest({
      ...baseManifest,
      importExceptions: [importException, { ...importException }],
    })).toThrow(/duplicate entry/u)

    const debt = {
      rule: 'feature.root-file',
      path: 'packages/a/src/old.ts',
      targetTask: 'fixture-cleanup',
      reason: 'fixture',
    }
    expect(() => validatePackageArchitectureManifest({
      ...baseManifest,
      debt: [debt, { ...debt, reason: 'duplicate' }],
    })).toThrow(/duplicate entry/u)
    expect(() => reconcilePackageArchitectureDiagnostics([], {
      ...baseManifest,
      debt: [debt, { ...debt, reason: 'duplicate' }],
    })).toThrow(/must be unique/u)

    const root = createFixture({})
    expect(() => validatePackageArchitectureManifest({
      ...baseManifest,
      debt: [debt],
    }, root)).toThrow(/points to missing task fixture-cleanup/u)

    const taskPath = resolve(root, '.trellis/tasks/09-03-fixture-cleanup/task.json')
    mkdirSync(dirname(taskPath), { recursive: true })
    writeFileSync(taskPath, JSON.stringify({ id: 'fixture-cleanup' }))
    expect(() => validatePackageArchitectureManifest({
      ...baseManifest,
      debt: [debt],
    }, root)).toThrow(/must belong to packages-architecture-governance/u)

    const parentPath = resolve(root, '.trellis/tasks/09-03-packages-architecture-governance/task.json')
    mkdirSync(dirname(parentPath), { recursive: true })
    writeFileSync(parentPath, JSON.stringify({ id: 'packages-architecture-governance' }))
    writeFileSync(taskPath, JSON.stringify({
      id: 'fixture-cleanup',
      parent: '09-03-packages-architecture-governance',
    }))
    expect(validatePackageArchitectureManifest({
      ...baseManifest,
      debt: [debt],
    }, root).debt).toEqual([debt])
  })

  it('matches the checked-in workspace exceptions and debt exactly', () => {
    const result = verifyPackageArchitecture(repositoryRoot)
    expect(result.reconciliation.unknown).toEqual([])
    expect(result.reconciliation.staleDebt).toEqual([])
    expect(result.reconciliation.staleExceptions).toEqual([])
  })

  it('keeps the checked-in manifest read-only during CLI verification', () => {
    const manifestPath = resolve(repositoryRoot, 'scripts/package-architecture/config/manifest.json')
    const before = readFileSync(manifestPath, 'utf8')
    const beforeMtime = statSync(manifestPath).mtimeMs
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(runPackageArchitectureCli(repositoryRoot, [])).toBe(0)
      expect(runPackageArchitectureCli(repositoryRoot, ['--update'])).toBe(1)
    }
    finally {
      log.mockRestore()
      error.mockRestore()
    }
    expect(readFileSync(manifestPath, 'utf8')).toBe(before)
    expect(statSync(manifestPath).mtimeMs).toBe(beforeMtime)
  })

  it('supports audit and JSON modes without writing the manifest', () => {
    const manifest = JSON.stringify({
      version: 1,
      packageExceptions: [],
      pathExceptions: [],
      componentExceptions: [],
      importExceptions: [],
      debt: [],
    })
    const root = createFixture({
      'packages/good/package.json': packageManifest('@fixture/good'),
      'packages/good/index.ts': 'export * from \'./src/feature\'\n',
      'packages/good/src/feature/index.ts': 'export * from \'./services\'\n',
      'packages/good/src/feature/services/index.ts': 'export { value } from \'./value\'\n',
      'packages/good/src/feature/services/value.ts': 'export const value = 1\n',
      'scripts/package-architecture/config/manifest.json': manifest,
    })
    const manifestPath = resolve(root, 'scripts/package-architecture/config/manifest.json')
    const beforeMtime = statSync(manifestPath).mtimeMs
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(runPackageArchitectureCli(root, ['--audit'])).toBe(0)
      expect(runPackageArchitectureCli(root, ['--audit', '--json'])).toBe(0)
      expect(runPackageArchitectureCli(root, ['--json'])).toBe(0)
    }
    finally {
      log.mockRestore()
      error.mockRestore()
    }
    expect(readFileSync(manifestPath, 'utf8')).toBe(manifest)
    expect(statSync(manifestPath).mtimeMs).toBe(beforeMtime)
  })
})
