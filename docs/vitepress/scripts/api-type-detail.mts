import type { ComponentContract } from '@moluoxixi/ai-doc-assistant'
import ts from 'typescript'

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

function definitionReferences(definition: TypeDefinition, availableNames: Set<string>): string[] {
  const result: string[] = []
  const sourceFile = ts.createSourceFile(
    `${definition.name}.ts`,
    definition.raw,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

  const addReference = (name: string, boundNames: ReadonlySet<string>) => {
    if (
      name !== definition.name
      && !boundNames.has(name)
      && availableNames.has(name)
      && !result.includes(name)
    ) {
      result.push(name)
    }
  }

  const visitEntityName = (name: ts.EntityName, boundNames: ReadonlySet<string>) => {
    if (ts.isIdentifier(name)) {
      addReference(name.text, boundNames)
      return
    }
    visitEntityName(name.left, boundNames)
    addReference(name.right.text, boundNames)
  }

  const visitExpressionName = (expression: ts.Expression, boundNames: ReadonlySet<string>) => {
    if (ts.isIdentifier(expression)) {
      addReference(expression.text, boundNames)
      return
    }
    if (ts.isPropertyAccessExpression(expression)) {
      visitExpressionName(expression.expression, boundNames)
      addReference(expression.name.text, boundNames)
    }
  }

  const collectInferNames = (node: ts.Node, names: Set<string>) => {
    if (ts.isInferTypeNode(node))
      names.add(node.typeParameter.name.text)
    ts.forEachChild(node, child => collectInferNames(child, names))
  }

  const visit = (node: ts.Node, inheritedBoundNames: ReadonlySet<string>) => {
    const declaredTypeParameters = (node as ts.Node & {
      typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>
    }).typeParameters
    const singularTypeParameter = ts.isMappedTypeNode(node) || ts.isInferTypeNode(node)
      ? node.typeParameter
      : undefined
    const boundNames = declaredTypeParameters?.length || singularTypeParameter
      ? new Set([
          ...inheritedBoundNames,
          ...(declaredTypeParameters?.map(parameter => parameter.name.text) ?? []),
          ...(singularTypeParameter ? [singularTypeParameter.name.text] : []),
        ])
      : inheritedBoundNames

    if (ts.isTypeReferenceNode(node))
      visitEntityName(node.typeName, boundNames)
    else if (ts.isExpressionWithTypeArguments(node))
      visitExpressionName(node.expression, boundNames)
    else if (ts.isTypeQueryNode(node))
      visitEntityName(node.exprName, boundNames)

    if (ts.isConditionalTypeNode(node)) {
      visit(node.checkType, boundNames)
      visit(node.extendsType, boundNames)
      const inferNames = new Set<string>()
      collectInferNames(node.extendsType, inferNames)
      visit(node.trueType, inferNames.size > 0 ? new Set([...boundNames, ...inferNames]) : boundNames)
      visit(node.falseType, boundNames)
      return
    }

    ts.forEachChild(node, child => visit(child, boundNames))
  }

  visit(sourceFile, new Set())
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
