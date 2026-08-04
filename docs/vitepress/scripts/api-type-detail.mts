import type { ComponentContract } from '@moluoxixi/ai-doc-assistant'

type TypeDefinition = ComponentContract['typeDefs'][number]

interface TypeGraph {
  direct: TypeDefinition[]
  transitive: TypeDefinition[]
}

interface DefinitionSummary {
  text: string
  truncated: boolean
}

const MAX_DEFINITION_LENGTH = 1800
const MAX_DEFINITION_FIELDS = 14
const MAX_DETAIL_LINES = 18
const MAX_DETAIL_CHARACTERS = 1800
const MAX_DETAIL_LINE_CHARACTERS = 180
const MAX_DIRECT_DEFINITIONS = 3
const OMITTED_DETAIL_MESSAGE = '// ... additional referenced type details omitted'
const TRUNCATED_EXPRESSION_MESSAGE = '// ... type expression truncated'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function identifiersInType(value: string): string[] {
  const withoutLabels = value.replace(/\b[a-z_$][\w$]*\s*(?=\??:)/gi, '')
  return withoutLabels.match(/[a-z_$][\w$]*/gi) ?? []
}

function definitionReferences(definition: TypeDefinition, availableNames: Set<string>): string[] {
  const sources = definition.fields.map(field => field.type)
  if (definition.kind === 'interface') {
    const declarationStart = definition.raw.search(
      new RegExp(`(?:export\\s+)?interface\\s+${escapeRegExp(definition.name)}\\b`),
    )
    const openingBrace = declarationStart >= 0 ? definition.raw.indexOf('{', declarationStart) : -1
    if (declarationStart >= 0 && openingBrace > declarationStart)
      sources.push(definition.raw.slice(declarationStart, openingBrace))
  }

  const result: string[] = []
  for (const source of sources) {
    for (const identifier of identifiersInType(source)) {
      if (identifier !== definition.name && availableNames.has(identifier) && !result.includes(identifier))
        result.push(identifier)
    }
  }
  return result
}

function collectTypeGraph(typeDefs: TypeDefinition[], refs: string[]): TypeGraph {
  const definitionsByName = new Map(typeDefs.map(definition => [definition.name, definition]))
  const availableNames = new Set(definitionsByName.keys())
  const directNames = refs.filter((ref, index) => definitionsByName.has(ref) && refs.indexOf(ref) === index)
  const selected = new Set<string>()
  const ordered: TypeDefinition[] = []
  const pending = [...directNames]

  for (let index = 0; index < pending.length; index++) {
    const name = pending[index]
    if (selected.has(name))
      continue

    const definition = definitionsByName.get(name)
    if (!definition)
      continue

    selected.add(name)
    ordered.push(definition)
    for (const dependency of definitionReferences(definition, availableNames)) {
      if (!selected.has(dependency) && !pending.includes(dependency))
        pending.push(dependency)
    }
  }

  const directNameSet = new Set(directNames)
  return {
    direct: ordered.filter(definition => directNameSet.has(definition.name)),
    transitive: ordered.filter(definition => !directNameSet.has(definition.name)),
  }
}

function truncateLine(value: string, suffix = '...'): { text: string, truncated: boolean } {
  if (value.length <= MAX_DETAIL_LINE_CHARACTERS)
    return { text: value, truncated: false }
  return {
    text: `${value.slice(0, MAX_DETAIL_LINE_CHARACTERS - suffix.length)}${suffix}`,
    truncated: true,
  }
}

function declarationHeader(definition: TypeDefinition): string {
  const raw = definition.raw.replace(/\r\n/g, '\n')
  const declarationPattern = new RegExp(
    `(?:export\\s+)?${definition.kind === 'interface' ? 'interface' : 'type'}\\s+${escapeRegExp(definition.name)}\\b`,
  )
  const declarationStart = raw.search(declarationPattern)
  const openingBrace = declarationStart >= 0 ? raw.indexOf('{', declarationStart) : -1
  if (declarationStart >= 0 && openingBrace > declarationStart)
    return raw.slice(declarationStart, openingBrace + 1).replace(/\s+/g, ' ')
  return definition.kind === 'interface'
    ? `interface ${definition.name} {`
    : `type ${definition.name} = {`
}

function summarizeDefinition(definition: TypeDefinition, fieldLimit: number): DefinitionSummary {
  const raw = definition.raw.replace(/\r\n/g, '\n').trim()
  if (definition.fields.length === 0) {
    const singleLine = raw.replace(/\s+/g, ' ')
    const line = truncateLine(singleLine, ' /* ... */')
    return {
      text: line.truncated ? `${line.text}\n// ... type definition truncated` : line.text,
      truncated: line.truncated,
    }
  }

  const fields = definition.fields.slice(0, fieldLimit).map((field) => {
    const optional = field.optional ? '?' : ''
    return truncateLine(`  ${field.name}${optional}: ${field.type}`, ' /* ... */').text
  })
  const remaining = definition.fields.length - fields.length
  if (remaining > 0)
    fields.push(`  // ... ${remaining} more fields`)

  return {
    text: `${truncateLine(declarationHeader(definition), ' ... {').text}\n${fields.join('\n')}\n}`,
    truncated: remaining > 0 || fields.some(line => line.endsWith(' /* ... */')),
  }
}

function fullDefinition(definition: TypeDefinition): string {
  const raw = definition.raw.replace(/\r\n/g, '\n').trim()
  if (raw.length <= MAX_DEFINITION_LENGTH)
    return raw
  return summarizeDefinition(definition, MAX_DEFINITION_FIELDS).text
}

function detailFits(detail: string): boolean {
  const lines = detail.split('\n')
  return lines.length <= MAX_DETAIL_LINES
    && detail.length <= MAX_DETAIL_CHARACTERS
    && lines.every(line => line.length <= MAX_DETAIL_LINE_CHARACTERS)
}

function appendBlock(blocks: string[], block: string, reserveLines = 0): boolean {
  const candidate = [...blocks, block].join('\n\n')
  return candidate.split('\n').length + reserveLines <= MAX_DETAIL_LINES
    && candidate.length <= MAX_DETAIL_CHARACTERS
    && (blocks.push(block), true)
}

function summarizeTypeGraph(type: string, graph: TypeGraph): string {
  const typeExpression = truncateLine(type)
  const blocks = [typeExpression.text]
  let detailsOmitted = graph.direct.length > MAX_DIRECT_DEFINITIONS
  const direct = graph.direct.slice(0, MAX_DIRECT_DEFINITIONS)
  const directFieldLimit = direct.length <= 1 ? 6 : direct.length === 2 ? 2 : 0

  for (const definition of direct) {
    const summary = summarizeDefinition(definition, directFieldLimit)
    if (!appendBlock(blocks, summary.text, 2))
      detailsOmitted = true
    detailsOmitted ||= summary.truncated
  }

  for (const definition of graph.transitive) {
    const summary = summarizeDefinition(definition, 1)
    if (!appendBlock(blocks, summary.text, 2)) {
      detailsOmitted = true
      break
    }
    detailsOmitted ||= summary.truncated
  }

  if (typeExpression.truncated)
    appendBlock(blocks, TRUNCATED_EXPRESSION_MESSAGE, detailsOmitted ? 2 : 0)
  if (detailsOmitted)
    appendBlock(blocks, OMITTED_DETAIL_MESSAGE)

  return blocks.join('\n\n')
}

export function createTypeDetail(
  typeDefs: ComponentContract['typeDefs'],
  type: string,
  refs: string[],
): string | undefined {
  const graph = collectTypeGraph(typeDefs, refs)
  if (graph.direct.length === 0)
    return type.length > 42 ? [truncateLine(type).text, type.length > MAX_DETAIL_LINE_CHARACTERS ? TRUNCATED_EXPRESSION_MESSAGE : ''].filter(Boolean).join('\n\n') : undefined

  const detail = [type, ...graph.direct, ...graph.transitive]
    .map(value => typeof value === 'string' ? value : fullDefinition(value))
    .join('\n\n')
  return detailFits(detail) ? detail : summarizeTypeGraph(type, graph)
}
