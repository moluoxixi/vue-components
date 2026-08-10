import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { detectDependencies, readPackageJSON } from '../src/node'

const tempDirs: string[] = []

function createTempDir(prefix: string): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempDirs.push(cwd)
  return cwd
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true })
  }
})

describe('environment Utilities', () => {
  it('readPackageJSON should fetch manifest from the selected cwd safely', () => {
    const cwd = createTempDir('moluoxixi-valid-pkg-')
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'fixture-package' }))

    const pkg = readPackageJSON(cwd)

    expect(pkg).toMatchObject({ name: 'fixture-package' })
  })

  it('readPackageJSON should expose missing manifest failures', () => {
    const cwd = createTempDir('moluoxixi-no-pkg-')

    expect(() => readPackageJSON(cwd)).toThrow(/package\.json/)
  })

  it('readPackageJSON should expose invalid manifest root shape failures with file context', () => {
    const cwd = createTempDir('moluoxixi-bad-shape-pkg-')
    fs.writeFileSync(path.join(cwd, 'package.json'), '[]')

    expect(() => readPackageJSON(cwd)).toThrow(/invalid package\.json shape/)
  })

  it('readPackageJSON should expose invalid dependency field shape failures with file context', () => {
    const cwd = createTempDir('moluoxixi-bad-deps-pkg-')
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ dependencies: [] }))

    expect(() => readPackageJSON(cwd)).toThrow(/invalid package\.json field "dependencies"/)
  })

  it('readPackageJSON should reject dependency entries with non-string versions', () => {
    const cwd = createTempDir('moluoxixi-bad-dep-version-pkg-')
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ dependencies: { vue: 3 } }))

    expect(() => readPackageJSON(cwd)).toThrow(/invalid package\.json field "dependencies\.vue"/)
  })

  it('detectDependencies should aggregate dependency map perfectly', () => {
    const cwd = createTempDir('moluoxixi-deps-pkg-')
    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify({
        dependencies: { vue: '^3.0.0' },
        devDependencies: { vite: '^7.0.0' },
        peerDependencies: { react: '^19.0.0' },
        optionalDependencies: { 'element-plus': '^2.0.0' },
      }),
    )

    const { deps, dependencies, devDependencies, optionalDependencies, peerDependencies, runtimeDeps } = detectDependencies(cwd)

    expect(deps).toMatchObject({
      'vue': '^3.0.0',
      'vite': '^7.0.0',
      'react': '^19.0.0',
      'element-plus': '^2.0.0',
    })
    expect(dependencies).toEqual({ vue: '^3.0.0' })
    expect(devDependencies).toEqual({ vite: '^7.0.0' })
    expect(runtimeDeps).toEqual({
      'vue': '^3.0.0',
      'react': '^19.0.0',
      'element-plus': '^2.0.0',
    })
    expect(deps).toEqual({
      'vue': '^3.0.0',
      'react': '^19.0.0',
      'element-plus': '^2.0.0',
      'vite': '^7.0.0',
    })
    expect(optionalDependencies).toEqual({ 'element-plus': '^2.0.0' })
    expect(peerDependencies).toEqual({ react: '^19.0.0' })
  })

  it('detectDependencies should keep empty manifests explicit instead of failing silently', () => {
    const cwd = createTempDir('moluoxixi-empty-pkg-')
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'empty-fixture' }))

    const { deps, dependencies, devDependencies, optionalDependencies, peerDependencies, runtimeDeps } = detectDependencies(cwd)

    expect(deps).toEqual({})
    expect(dependencies).toEqual({})
    expect(devDependencies).toEqual({})
    expect(optionalDependencies).toEqual({})
    expect(peerDependencies).toEqual({})
    expect(runtimeDeps).toEqual({})
  })

  it('detectDependencies should return detached dependency snapshots', () => {
    const cwd = createTempDir('moluoxixi-detached-pkg-')
    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify({
        dependencies: { vue: '^3.0.0' },
        devDependencies: { vite: '^7.0.0' },
      }),
    )

    const first = detectDependencies(cwd)
    first.dependencies.vue = '^9.9.9'
    first.devDependencies.vite = '^9.9.9'
    first.deps.vite = '^9.9.9'
    first.runtimeDeps.vue = '^9.9.9'

    const second = detectDependencies(cwd)

    expect(second.dependencies.vue).toBe('^3.0.0')
    expect(second.devDependencies.vite).toBe('^7.0.0')
    expect(second.deps.vite).toBe('^7.0.0')
    expect(second.runtimeDeps.vue).toBe('^3.0.0')
  })
})
