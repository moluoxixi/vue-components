import { describe, expect, it } from 'vitest'

import {
  findPackagesNeedingChangesets,
  normalizeManifestForChangeDetection,
  renderPatchChangeset,
} from '../auto-changesets.mjs'

const packages = [
  { name: '@moluoxixi/alpha', relativeDirectory: 'packages/alpha' },
  { name: '@moluoxixi/beta', relativeDirectory: 'packages/beta' },
]

describe('findPackagesNeedingChangesets', () => {
  it('selects only packages with meaningful files changed', () => {
    const selected = findPackagesNeedingChangesets({
      packages,
      changedFiles: [
        'packages/alpha/src/index.ts',
        'packages/beta/CHANGELOG.md',
        'pnpm-lock.yaml',
      ],
      pendingPackageNames: new Set(),
    })

    expect(selected.map(pkg => pkg.name)).toEqual(['@moluoxixi/alpha'])
  })

  it('does not duplicate a package already covered by a pending changeset', () => {
    const selected = findPackagesNeedingChangesets({
      packages,
      changedFiles: ['packages/alpha/src/index.ts', 'packages/beta/src/index.ts'],
      pendingPackageNames: new Set(['@moluoxixi/alpha']),
    })

    expect(selected.map(pkg => pkg.name)).toEqual(['@moluoxixi/beta'])
  })

  it('ignores generated build and release artifacts', () => {
    const selected = findPackagesNeedingChangesets({
      packages,
      changedFiles: [
        'packages/alpha/dist/index.js',
        'packages/alpha/coverage/index.html',
        'packages/alpha/tsconfig.tsbuildinfo',
        'packages/beta/CHANGELOG.md',
      ],
      pendingPackageNames: new Set(),
    })

    expect(selected).toEqual([])
  })

  it('delegates package manifest classification to the manifest comparator', () => {
    const selected = findPackagesNeedingChangesets({
      packages,
      changedFiles: ['packages/alpha/package.json', 'packages/beta/package.json'],
      pendingPackageNames: new Set(),
      hasManifestChange: pkg => pkg.name === '@moluoxixi/beta',
    })

    expect(selected.map(pkg => pkg.name)).toEqual(['@moluoxixi/beta'])
  })
})

describe('normalizeManifestForChangeDetection', () => {
  it('ignores version and internal dependency ranges from release PRs', () => {
    const normalized = normalizeManifestForChangeDetection({
      name: '@moluoxixi/alpha',
      version: '2.0.0',
      dependencies: {
        '@moluoxixi/beta': '^2.0.0',
        'defu': '^6.1.4',
      },
      peerDependencies: {
        '@moluoxixi/beta': '^2.0.0',
      },
    }, new Set(['@moluoxixi/alpha', '@moluoxixi/beta']))

    expect(normalized).toEqual({
      name: '@moluoxixi/alpha',
      dependencies: { defu: '^6.1.4' },
      peerDependencies: {},
    })
  })
})

describe('renderPatchChangeset', () => {
  it('renders deterministic patch releases', () => {
    expect(renderPatchChangeset([
      '@moluoxixi/beta',
      '@moluoxixi/alpha',
    ], '123456789abc')).toBe(`---
"@moluoxixi/alpha": patch
"@moluoxixi/beta": patch
---

Automatically release packages changed in 123456789abc.
`)
  })
})
