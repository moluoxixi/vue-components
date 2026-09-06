import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|vue)$/.test(entry.name) ? [path] : []
  })
}

describe('config-form designer architecture boundary', () => {
  it('uses Runtime public contracts instead of private implementation paths', () => {
    const violations = sourceFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return /@moluoxixi\/config-form\/(?:src|renderer|runtime|components)(?:['"/]|$)/.test(source)
        ? [path]
        : []
    })

    expect(violations).toEqual([])
  })
})
