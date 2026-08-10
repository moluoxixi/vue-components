// Copied from Element Plus docs/.vitepress/vitepress/components/demo/code-fold.ts
// at the commit recorded in UPSTREAM.md.

export interface FoldRegion {
  start: number
  end: number
}

const TAB_SIZE = 4

export function getIndent(line: string): number {
  let indent = 0
  for (const character of line) {
    if (character === ' ')
      indent += 1
    else if (character === '\t')
      indent = Math.floor(indent / TAB_SIZE) * TAB_SIZE + TAB_SIZE
    else
      break
  }
  return indent
}

function isBlank(line: string): boolean {
  return line.trim() === ''
}

export function computeFoldRegions(lines: string[]): FoldRegion[] {
  const regions: FoldRegion[] = []

  for (let start = 0; start < lines.length - 1; start += 1) {
    if (isBlank(lines[start] ?? ''))
      continue

    const indent = getIndent(lines[start] ?? '')
    let bound = -1
    for (let index = start + 1; index < lines.length; index += 1) {
      if (isBlank(lines[index] ?? ''))
        continue
      if (getIndent(lines[index] ?? '') <= indent) {
        bound = index
        break
      }
    }
    if (bound === -1)
      bound = lines.length

    let end = bound - 1
    while (end > start && isBlank(lines[end] ?? ''))
      end -= 1

    if (end > start)
      regions.push({ start, end })
  }

  return regions
}
