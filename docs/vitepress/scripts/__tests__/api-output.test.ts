// @vitest-environment node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { syncApiOutputDirectory } from '../api-output.mts'

const roots: string[] = []

function createFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'component-api-output-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('api output directory', () => {
  it('removes stale JSON while preserving expected contracts and unrelated files', () => {
    const outDir = createFixtureRoot()
    writeFileSync(resolve(outDir, 'CopyText.json'), '{}\n', 'utf8')
    writeFileSync(resolve(outDir, 'RemovedComponent.json'), '{}\n', 'utf8')
    writeFileSync(resolve(outDir, 'README.md'), 'generated output\n', 'utf8')

    expect(syncApiOutputDirectory(outDir, ['CopyText'])).toEqual(['RemovedComponent.json'])
    expect(readFileSync(resolve(outDir, 'CopyText.json'), 'utf8')).toBe('{}\n')
    expect(readFileSync(resolve(outDir, 'README.md'), 'utf8')).toBe('generated output\n')
  })

  it('rejects non-file JSON entries instead of writing through them', () => {
    const outDir = createFixtureRoot()
    mkdirSync(resolve(outDir, 'CopyText.json'))

    expect(() => syncApiOutputDirectory(outDir, ['CopyText']))
      .toThrow('API output contains non-file entries: CopyText.json')
  })
})
