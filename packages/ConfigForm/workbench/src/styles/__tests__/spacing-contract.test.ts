import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url))

function ownedStyles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      return entry.name === '__tests__' ? [] : ownedStyles(path)
    return ['.css', '.scss', '.vue'].includes(extname(path)) ? [path] : []
  })
}

describe('workbench spacing policy', () => {
  it('uses the Tailwind 0–4 scale for owned UI spacing, with system safe insets kept separate', () => {
    const violations: string[] = []
    for (const file of ['app', 'components', 'features', 'styles'].flatMap(directory => ownedStyles(join(sourceRoot, directory)))) {
      const source = readFileSync(file, 'utf8')
      const css = extname(file) === '.vue' ? source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? '' : source
      for (const match of css.matchAll(/(?<![\w-])(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z-]+)?:([^;{}]+);/g)) {
        if (!match[1]!.includes('--wb-safe-'))
          violations.push(`${relative(sourceRoot, file)}: ${match[0]}`)
      }
      // Inspect utilities in both templates and @apply, including responsive variants.
      for (const match of source.matchAll(/(?<![\w-])-?(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?)-([\d.]+|\[[^\]]+\])(?:!|\b)/g)) {
        if (!['0', '1', '2', '3', '4'].includes(match[1]!))
          violations.push(`${relative(sourceRoot, file)}: ${match[0]}`)
      }
    }
    expect(violations).toEqual([])
  })
})
