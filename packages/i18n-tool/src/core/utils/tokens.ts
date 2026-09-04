import type { ProtectedToken } from '../types'

interface TokenMatch extends ProtectedToken {
  index: number
}

function collectMatches(
  value: string,
  kind: ProtectedToken['kind'],
  expression: RegExp,
  occupied: readonly { end: number, start: number }[] = [],
): TokenMatch[] {
  return [...value.matchAll(expression)]
    .filter(match => match.index !== undefined)
    .filter((match) => {
      const start = match.index!
      const end = start + match[0].length
      return !occupied.some(range => start < range.end && end > range.start)
    })
    .map(match => ({ index: match.index!, kind, value: match[0] }))
}

function collectHtmlTags(value: string): TokenMatch[] {
  const tags: TokenMatch[] = []
  for (let start = 0; start < value.length; start += 1) {
    if (value[start] !== '<' || !/^<\/?[A-Z]/i.test(value.slice(start)))
      continue
    let quote: '"' | '\'' | undefined
    for (let end = start + 1; end < value.length; end += 1) {
      const character = value[end]
      if (quote) {
        if (character === quote)
          quote = undefined
        continue
      }
      if (character === '"' || character === '\'') {
        quote = character
        continue
      }
      if (character !== '>')
        continue
      tags.push({ index: start, kind: 'html-tag', value: value.slice(start, end + 1) })
      start = end
      break
    }
  }
  return tags
}

export function extractProtectedTokens(value: string): ProtectedToken[] {
  const i18next = collectMatches(value, 'i18next', /\{\{[^{}]+\}\}/g)
  const occupied = i18next.map(token => ({ end: token.index + token.value.length, start: token.index }))
  const tokens: TokenMatch[] = [
    ...i18next,
    ...collectMatches(value, 'vue', /(?<!\{)\{[A-Z_][\w.-]*\}(?!\})/gi, occupied),
    ...collectMatches(value, 'printf', /%(?:\d+\$)?[sdif]/g),
    ...collectMatches(value, 'escaped-newline', /\\n/g),
    ...collectHtmlTags(value),
    ...collectMatches(value, 'vue-linked', /@(?:\.(?:capitalize|lower|upper))?:(?:\{[^}]+\}|[\w.\-[\]]+)/g),
    ...collectMatches(value, 'plural-pipe', /\|/g),
  ]

  return tokens
    .sort((left, right) => left.index - right.index || left.kind.localeCompare(right.kind))
    .map(({ kind, value: tokenValue }) => ({ kind, value: tokenValue }))
}

function tokenCounts(tokens: readonly ProtectedToken[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const token of tokens) {
    const key = `${token.kind}\0${token.value}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export function protectedTokensEqual(source: string, candidate: string): boolean {
  const sourceCounts = tokenCounts(extractProtectedTokens(source))
  const candidateCounts = tokenCounts(extractProtectedTokens(candidate))
  if (sourceCounts.size !== candidateCounts.size)
    return false
  return [...sourceCounts].every(([key, count]) => candidateCounts.get(key) === count)
}
