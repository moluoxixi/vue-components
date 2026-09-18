import type { ConfigFormExpressionNode } from '../../expression'
import type {
  ConfigFormFieldResolution,
  ConfigFormValueContext,
  ConfigFormValueInput,
  ConfigFormValueReference,
  ConfigFormValueReferenceCollectionEntry,
  ConfigFormValueReferenceRemap,
  ConfigFormValueReferenceScope,
} from '../types'
import {
  evaluateConfigFormExpression,
  parseConfigFormExpression,
} from '../../expression'

export const CONFIG_FORM_VALUE_MAX_DEPTH = 32
export const CONFIG_FORM_VALUE_MAX_VISITS = 10_000

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const REFERENCE_ROOTS: ReadonlyMap<string, 'field' | 'variable'> = new Map([
  ['$fields', 'field'],
  ['$variables', 'variable'],
])
const REFERENCE_KINDS = new Set(['literal', 'field', 'variable', 'event', 'expression'])
const FIELD_SCOPES = new Set<ConfigFormValueReferenceScope>(['current', 'parent', 'root'])

interface TraversalState {
  visits: number
  readonly ancestors: Set<object>
}

interface ExpressionReference {
  kind: 'field' | 'variable'
  id: string
}

interface ExpressionAnalysis {
  ast: ConfigFormExpressionNode
  references: ExpressionReference[]
  usesEvent: boolean
}

interface NormalizedRemap {
  fields: ReadonlyMap<string, string>
  variables: ReadonlyMap<string, string>
}

export class ConfigFormValueReferenceError extends Error {
  readonly code: string
  readonly path: string

  constructor(code: string, message: string, path = '$', options?: ErrorOptions) {
    super(message, options)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.path = path
  }
}

/** Resolves a JSON value tree while interpreting only exact single-key {$ref} wrappers. */
export function resolveConfigFormValueInput(
  input: ConfigFormValueInput,
  context: ConfigFormValueContext = {},
): unknown {
  assertContext(context)
  const state = createTraversalState()
  return walkInput(input, state, '$', 0, true, (reference, path, depth) => (
    resolveReference(reference, context, state, path, depth)
  ))
}

/** Lists stable field and variable identities in traversal order. */
export function collectConfigFormValueReferences(
  input: ConfigFormValueInput,
): ConfigFormValueReferenceCollectionEntry[] {
  const references: ConfigFormValueReferenceCollectionEntry[] = []
  const state = createTraversalState()
  walkInput(input, state, '$', 0, true, (reference, path) => {
    collectReference(reference, path, references, state)
    return { $ref: reference }
  })
  return references
}

/** Returns a defensive copy with direct and expression identities structurally remapped. */
export function remapConfigFormValueReferences(
  input: ConfigFormValueInput,
  maps: ConfigFormValueReferenceRemap = {},
): ConfigFormValueInput {
  const normalizedMaps = normalizeRemap(maps)
  const state = createTraversalState()
  return walkInput(input, state, '$', 0, true, (reference, path) => ({
    $ref: remapReference(reference, normalizedMaps, path, state),
  })) as ConfigFormValueInput
}

function createTraversalState(): TraversalState {
  return { ancestors: new Set<object>(), visits: 0 }
}

function enterValue(state: TraversalState, depth: number, path: string): void {
  state.visits += 1
  if (depth > CONFIG_FORM_VALUE_MAX_DEPTH) {
    throw new ConfigFormValueReferenceError(
      'CONFIG_FORM_VALUE_DEPTH_EXCEEDED',
      `Value input exceeds the maximum depth of ${CONFIG_FORM_VALUE_MAX_DEPTH}.`,
      path,
    )
  }
  if (state.visits > CONFIG_FORM_VALUE_MAX_VISITS) {
    throw new ConfigFormValueReferenceError(
      'CONFIG_FORM_VALUE_VISIT_LIMIT_EXCEEDED',
      `Value input exceeds the maximum visit count of ${CONFIG_FORM_VALUE_MAX_VISITS}.`,
      path,
    )
  }
}

function walkInput(
  input: unknown,
  state: TraversalState,
  path: string,
  depth: number,
  interpretReferences: boolean,
  handleReference: (
    reference: ConfigFormValueReference,
    path: string,
    depth: number,
  ) => unknown,
): unknown {
  enterValue(state, depth, path)
  if (input === null || typeof input === 'string' || typeof input === 'boolean')
    return input
  if (typeof input === 'number') {
    if (!Number.isFinite(input))
      throw invalidInput('JSON numbers must be finite.', path)
    return input
  }
  if (typeof input !== 'object')
    throw invalidInput('Value input must contain only JSON values and reference wrappers.', path)

  assertContainer(input, path, Array.isArray(input))
  if (state.ancestors.has(input)) {
    throw new ConfigFormValueReferenceError(
      'CONFIG_FORM_VALUE_CYCLE',
      'Value input contains a circular reference.',
      path,
    )
  }
  state.ancestors.add(input)
  try {
    const entries = readDataEntries(input, path)
    if (Array.isArray(input)) {
      return entries.map(([key, value]) => walkInput(
        value,
        state,
        appendIndex(path, Number(key)),
        depth + 1,
        interpretReferences,
        handleReference,
      ))
    }

    const hasReferenceKey = entries.some(([key]) => key === '$ref')
    if (interpretReferences && hasReferenceKey) {
      if (entries.length !== 1) {
        throw new ConfigFormValueReferenceError(
          'CONFIG_FORM_VALUE_REFERENCE_WRAPPER_INVALID',
          'A value reference wrapper must contain only the "$ref" key.',
          path,
        )
      }
      const reference = parseReference(entries[0]![1], state, appendProperty(path, '$ref'), depth + 1)
      return handleReference(reference, path, depth + 1)
    }

    const result: Record<string, unknown> = {}
    for (const [key, value] of entries) {
      result[key] = walkInput(
        value,
        state,
        appendProperty(path, key),
        depth + 1,
        interpretReferences,
        handleReference,
      )
    }
    return result
  }
  finally {
    state.ancestors.delete(input)
  }
}

function parseReference(
  input: unknown,
  state: TraversalState,
  path: string,
  depth: number,
): ConfigFormValueReference {
  enterValue(state, depth, path)
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw invalidReference('The "$ref" value must be an object.', path)
  assertContainer(input, path, false)
  if (state.ancestors.has(input)) {
    throw new ConfigFormValueReferenceError(
      'CONFIG_FORM_VALUE_CYCLE',
      'Value reference contains a circular reference.',
      path,
    )
  }
  state.ancestors.add(input)
  try {
    const entries = readDataEntries(input, path)
    const values = new Map(entries)
    const kind = values.get('kind')
    enterValue(state, depth + 1, appendProperty(path, 'kind'))
    if (typeof kind !== 'string' || !REFERENCE_KINDS.has(kind))
      throw invalidReference(`Unknown value reference kind: ${String(kind)}.`, appendProperty(path, 'kind'))

    switch (kind) {
      case 'literal': {
        assertReferenceKeys(entries, ['kind', 'value'], path)
        const value = walkInput(
          values.get('value'),
          state,
          appendProperty(path, 'value'),
          depth + 1,
          false,
          reference => ({ $ref: reference }),
        )
        return { kind, value: value as Extract<ConfigFormValueReference, { kind: 'literal' }>['value'] }
      }
      case 'field': {
        assertReferenceKeys(entries, ['kind', 'nodeId'], path, ['scope'])
        const nodeId = readIdentity(values.get('nodeId'), state, appendProperty(path, 'nodeId'), depth + 1)
        const hasScope = values.has('scope')
        const scopeValue = values.get('scope')
        if (hasScope) {
          enterValue(state, depth + 1, appendProperty(path, 'scope'))
          if (typeof scopeValue !== 'string' || !FIELD_SCOPES.has(scopeValue as ConfigFormValueReferenceScope))
            throw invalidReference('Field scope must be current, parent, or root.', appendProperty(path, 'scope'))
        }
        return {
          kind,
          nodeId,
          ...(hasScope ? { scope: scopeValue as ConfigFormValueReferenceScope } : {}),
        }
      }
      case 'variable':
        assertReferenceKeys(entries, ['kind', 'variableId'], path)
        return {
          kind,
          variableId: readIdentity(values.get('variableId'), state, appendProperty(path, 'variableId'), depth + 1),
        }
      case 'event':
        assertReferenceKeys(entries, ['kind', 'path'], path)
        return {
          kind,
          path: readReferencePath(values.get('path'), state, appendProperty(path, 'path'), depth + 1),
        }
      case 'expression': {
        assertReferenceKeys(entries, ['kind', 'source'], path)
        const source = values.get('source')
        enterValue(state, depth + 1, appendProperty(path, 'source'))
        if (typeof source !== 'string' || source.trim().length === 0)
          throw invalidReference('Expression source must be a non-empty string.', appendProperty(path, 'source'))
        return { kind, source }
      }
      default:
        throw invalidReference(`Unknown value reference kind: ${String(kind)}.`, appendProperty(path, 'kind'))
    }
  }
  finally {
    state.ancestors.delete(input)
  }
}

function resolveReference(
  reference: ConfigFormValueReference,
  context: ConfigFormValueContext,
  state: TraversalState,
  path: string,
  depth: number,
): unknown {
  switch (reference.kind) {
    case 'literal':
      return reference.value
    case 'field': {
      const scope = reference.scope ?? 'current'
      const resolution = resolveField(context, reference.nodeId, scope, path)
      return cloneResolvedValue(resolution.value, state, path, depth)
    }
    case 'variable':
      return cloneResolvedValue(
        readContextIdentity(context.variables, reference.variableId, 'variable', path),
        state,
        path,
        depth,
      )
    case 'event': {
      if (!Object.hasOwn(context, 'event'))
        throw missingReference('event', reference.path.join('.'), path)
      const resolution = readPath(context.event, reference.path)
      if (!resolution.found)
        throw missingReference('event', reference.path.join('.'), path)
      return cloneResolvedValue(resolution.value, state, path, depth)
    }
    case 'expression':
      return resolveExpression(reference.source, context, state, path, depth)
  }
}

function resolveExpression(
  source: string,
  context: ConfigFormValueContext,
  state: TraversalState,
  path: string,
  depth: number,
): unknown {
  const analysis = analyzeExpression(source, path, state)
  const fields: Record<string, unknown> = Object.create(null)
  const variables: Record<string, unknown> = Object.create(null)
  const resolved = new Set<string>()

  for (const reference of analysis.references) {
    const key = `${reference.kind}\0${reference.id}`
    if (resolved.has(key))
      continue
    resolved.add(key)
    if (reference.kind === 'field') {
      fields[reference.id] = cloneResolvedValue(
        resolveField(context, reference.id, 'current', path).value,
        state,
        path,
        depth,
      )
    }
    else {
      variables[reference.id] = cloneResolvedValue(
        readContextIdentity(context.variables, reference.id, 'variable', path),
        state,
        path,
        depth,
      )
    }
  }

  let event: unknown
  if (analysis.usesEvent) {
    if (!Object.hasOwn(context, 'event'))
      throw missingReference('event', '$event', path)
    event = cloneResolvedValue(context.event, state, path, depth)
  }

  let value: unknown
  try {
    value = evaluateConfigFormExpression(analysis.ast, {
      $event: event,
      $fields: fields,
      $variables: variables,
    })
  }
  catch (cause) {
    const code = readErrorCode(cause) ?? 'CONFIG_FORM_VALUE_EXPRESSION_EVALUATION_FAILED'
    throw new ConfigFormValueReferenceError(
      code,
      cause instanceof Error ? cause.message : 'Expression evaluation failed.',
      path,
      { cause },
    )
  }
  return cloneResolvedValue(value, state, path, depth)
}

function collectReference(
  reference: ConfigFormValueReference,
  path: string,
  target: ConfigFormValueReferenceCollectionEntry[],
  state: TraversalState,
): void {
  switch (reference.kind) {
    case 'field':
      target.push({ kind: 'field', id: reference.nodeId, path, scope: reference.scope ?? 'current' })
      break
    case 'variable':
      target.push({ kind: 'variable', id: reference.variableId, path })
      break
    case 'expression':
      analyzeExpression(reference.source, path, state).references.forEach((item) => {
        if (item.kind === 'field')
          target.push({ kind: 'field', id: item.id, path, scope: 'current' })
        else
          target.push({ kind: item.kind, id: item.id, path })
      })
      break
    case 'literal':
    case 'event':
      break
  }
}

function remapReference(
  reference: ConfigFormValueReference,
  maps: NormalizedRemap,
  path: string,
  state: TraversalState,
): ConfigFormValueReference {
  switch (reference.kind) {
    case 'field':
      return { ...reference, nodeId: maps.fields.get(reference.nodeId) ?? reference.nodeId }
    case 'variable':
      return { ...reference, variableId: maps.variables.get(reference.variableId) ?? reference.variableId }
    case 'expression': {
      const analysis = analyzeExpression(reference.source, path, state)
      const transformed = remapExpressionNode(analysis.ast, maps)
      if (!transformed.changed)
        return reference
      return { kind: 'expression', source: printExpressionNode(transformed.node) }
    }
    case 'literal':
    case 'event':
      return reference
  }
}

function analyzeExpression(
  source: string,
  path: string,
  state: TraversalState,
): ExpressionAnalysis {
  let ast: ConfigFormExpressionNode
  try {
    ast = parseConfigFormExpression(source)
  }
  catch (cause) {
    const code = readErrorCode(cause) ?? 'CONFIG_FORM_VALUE_EXPRESSION_INVALID'
    throw new ConfigFormValueReferenceError(
      code,
      cause instanceof Error ? cause.message : 'Expression is invalid.',
      path,
      { cause },
    )
  }

  const references: ExpressionReference[] = []
  let usesEvent = false
  const visit = (node: ConfigFormExpressionNode): void => {
    state.visits += 1
    if (state.visits > CONFIG_FORM_VALUE_MAX_VISITS) {
      throw new ConfigFormValueReferenceError(
        'CONFIG_FORM_VALUE_VISIT_LIMIT_EXCEEDED',
        `Value input exceeds the maximum visit count of ${CONFIG_FORM_VALUE_MAX_VISITS}.`,
        path,
      )
    }
    switch (node.kind) {
      case 'literal':
        return
      case 'identifier':
        if (node.name === '$event') {
          usesEvent = true
          return
        }
        if (REFERENCE_ROOTS.has(node.name))
          throw dynamicExpressionReference(node.name, path)
        throw new ConfigFormValueReferenceError(
          'CONFIG_FORM_VALUE_EXPRESSION_IDENTIFIER_UNTRACKABLE',
          `Expression identifier "${node.name}" is not a stable value-reference root.`,
          path,
        )
      case 'member': {
        assertSafePathSegment(node.property, path)
        if (node.object.kind === 'identifier') {
          const kind = REFERENCE_ROOTS.get(node.object.name)
          if (kind) {
            assertIdentity(node.property, path)
            references.push({ id: node.property, kind })
            return
          }
          if (node.object.name === '$event') {
            usesEvent = true
            return
          }
        }
        visit(node.object)
        return
      }
      case 'index': {
        if (node.object.kind === 'identifier') {
          const kind = REFERENCE_ROOTS.get(node.object.name)
          if (kind) {
            if (node.index.kind !== 'literal' || typeof node.index.value !== 'string')
              throw dynamicExpressionReference(node.object.name, path)
            assertIdentity(node.index.value, path)
            references.push({ id: node.index.value, kind })
            return
          }
          if (node.object.name === '$event') {
            usesEvent = true
            if (node.index.kind === 'literal' && typeof node.index.value === 'string')
              assertSafePathSegment(node.index.value, path)
            else
              visit(node.index)
            return
          }
        }
        if (node.index.kind === 'literal' && typeof node.index.value === 'string')
          assertSafePathSegment(node.index.value, path)
        visit(node.object)
        visit(node.index)
        return
      }
      case 'array':
        node.items.forEach(visit)
        return
      case 'unary':
        visit(node.operand)
        return
      case 'binary':
        visit(node.left)
        visit(node.right)
        return
      case 'conditional':
        visit(node.test)
        visit(node.consequent)
        visit(node.alternate)
        return
      case 'call':
        if (REFERENCE_ROOTS.has(node.callee) || node.callee === '$event')
          throw dynamicExpressionReference(node.callee, path)
        node.args.forEach(visit)
    }
  }
  visit(ast)
  return { ast, references, usesEvent }
}

function remapExpressionNode(
  node: ConfigFormExpressionNode,
  maps: NormalizedRemap,
): { node: ConfigFormExpressionNode, changed: boolean } {
  switch (node.kind) {
    case 'literal':
    case 'identifier':
      return { changed: false, node }
    case 'member': {
      if (node.object.kind === 'identifier') {
        const map = expressionRootMap(node.object.name, maps)
        const replacement = map?.get(node.property)
        if (replacement !== undefined) {
          return {
            changed: true,
            node: {
              index: { kind: 'literal', value: replacement },
              kind: 'index',
              object: node.object,
            },
          }
        }
      }
      const object = remapExpressionNode(node.object, maps)
      return { changed: object.changed, node: object.changed ? { ...node, object: object.node } : node }
    }
    case 'index': {
      if (
        node.object.kind === 'identifier'
        && node.index.kind === 'literal'
        && typeof node.index.value === 'string'
      ) {
        const replacement = expressionRootMap(node.object.name, maps)?.get(node.index.value)
        if (replacement !== undefined) {
          return {
            changed: true,
            node: { ...node, index: { kind: 'literal', value: replacement } },
          }
        }
      }
      const object = remapExpressionNode(node.object, maps)
      const index = remapExpressionNode(node.index, maps)
      const changed = object.changed || index.changed
      return {
        changed,
        node: changed ? { ...node, index: index.node, object: object.node } : node,
      }
    }
    case 'array': {
      const items = node.items.map(item => remapExpressionNode(item, maps))
      const changed = items.some(item => item.changed)
      return { changed, node: changed ? { ...node, items: items.map(item => item.node) } : node }
    }
    case 'unary': {
      const operand = remapExpressionNode(node.operand, maps)
      return { changed: operand.changed, node: operand.changed ? { ...node, operand: operand.node } : node }
    }
    case 'binary': {
      const left = remapExpressionNode(node.left, maps)
      const right = remapExpressionNode(node.right, maps)
      const changed = left.changed || right.changed
      return { changed, node: changed ? { ...node, left: left.node, right: right.node } : node }
    }
    case 'conditional': {
      const test = remapExpressionNode(node.test, maps)
      const consequent = remapExpressionNode(node.consequent, maps)
      const alternate = remapExpressionNode(node.alternate, maps)
      const changed = test.changed || consequent.changed || alternate.changed
      return {
        changed,
        node: changed
          ? { ...node, alternate: alternate.node, consequent: consequent.node, test: test.node }
          : node,
      }
    }
    case 'call': {
      const args = node.args.map(argument => remapExpressionNode(argument, maps))
      const changed = args.some(argument => argument.changed)
      return { changed, node: changed ? { ...node, args: args.map(argument => argument.node) } : node }
    }
  }
}

function printExpressionNode(node: ConfigFormExpressionNode): string {
  switch (node.kind) {
    case 'literal': return JSON.stringify(node.value)
    case 'identifier': return node.name
    case 'member': return `${printPostfixObject(node.object)}.${node.property}`
    case 'index': return `${printPostfixObject(node.object)}[${printExpressionNode(node.index)}]`
    case 'array': return `[${node.items.map(printExpressionNode).join(', ')}]`
    case 'unary': return `(${node.operator}${printExpressionNode(node.operand)})`
    case 'binary': return `(${printExpressionNode(node.left)} ${node.operator} ${printExpressionNode(node.right)})`
    case 'conditional':
      return `(${printExpressionNode(node.test)} ? ${printExpressionNode(node.consequent)} : ${printExpressionNode(node.alternate)})`
    case 'call': return `${node.callee}(${node.args.map(printExpressionNode).join(', ')})`
  }
}

function printPostfixObject(node: ConfigFormExpressionNode): string {
  return node.kind === 'identifier' || node.kind === 'member' || node.kind === 'index' || node.kind === 'call'
    ? printExpressionNode(node)
    : `(${printExpressionNode(node)})`
}

function resolveField(
  context: ConfigFormValueContext,
  nodeId: string,
  scope: ConfigFormValueReferenceScope,
  path: string,
): ConfigFormFieldResolution {
  if (context.resolveField) {
    let resolution: ConfigFormFieldResolution
    try {
      resolution = context.resolveField(nodeId, scope)
    }
    catch (cause) {
      throw new ConfigFormValueReferenceError(
        'CONFIG_FORM_VALUE_FIELD_RESOLVER_FAILED',
        cause instanceof Error ? cause.message : `Field resolver failed for "${nodeId}".`,
        path,
        { cause },
      )
    }
    if (typeof resolution !== 'object' || resolution === null || typeof resolution.found !== 'boolean') {
      throw new ConfigFormValueReferenceError(
        'CONFIG_FORM_VALUE_FIELD_RESOLVER_INVALID',
        'Field resolver must return { found: boolean, value?: unknown }.',
        path,
      )
    }
    if (!resolution.found)
      throw missingReference('field', nodeId, path)
    return { found: true, value: resolution.value }
  }
  if (scope !== 'current')
    throw missingReference('field', nodeId, path)
  return {
    found: true,
    value: readContextIdentity(context.fields, nodeId, 'field', path),
  }
}

function readContextIdentity(
  source: Readonly<Record<string, unknown>> | undefined,
  id: string,
  kind: 'field' | 'variable',
  path: string,
): unknown {
  if (source === undefined || !Object.hasOwn(source, id))
    throw missingReference(kind, id, path)
  return source[id]
}

function readPath(root: unknown, segments: readonly string[]): ConfigFormFieldResolution {
  let value = root
  for (const segment of segments) {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function'))
      return { found: false }
    if (Array.isArray(value) && !isArrayIndex(segment))
      return { found: false }
    if (!Object.hasOwn(value, segment))
      return { found: false }
    value = (value as Record<string, unknown>)[segment]
  }
  return { found: true, value }
}

function cloneResolvedValue(
  value: unknown,
  state: TraversalState,
  path: string,
  depth: number,
): unknown {
  try {
    return walkInput(value, state, path, depth, false, reference => ({ $ref: reference }))
  }
  catch (cause) {
    if (cause instanceof ConfigFormValueReferenceError)
      throw cause
    throw invalidInput('Resolved values must be JSON-safe.', path)
  }
}

function readReferencePath(
  value: unknown,
  state: TraversalState,
  path: string,
  depth: number,
): string[] {
  enterValue(state, depth, path)
  if (!Array.isArray(value))
    throw invalidReference('Reference path must be an array of strings.', path)
  assertContainer(value, path, true)
  if (state.ancestors.has(value))
    throw new ConfigFormValueReferenceError('CONFIG_FORM_VALUE_CYCLE', 'Reference path is circular.', path)
  state.ancestors.add(value)
  try {
    const entries = readDataEntries(value, path)
    return entries.map(([key, segment]) => {
      const segmentPath = appendIndex(path, Number(key))
      enterValue(state, depth + 1, segmentPath)
      if (typeof segment !== 'string')
        throw invalidReference('Reference path entries must be strings.', segmentPath)
      assertSafePathSegment(segment, segmentPath)
      return segment
    })
  }
  finally {
    state.ancestors.delete(value)
  }
}

function normalizeRemap(input: ConfigFormValueReferenceRemap): NormalizedRemap {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw new ConfigFormValueReferenceError('CONFIG_FORM_VALUE_REMAP_INVALID', 'Reference remap must be an object.', '$maps')
  const prototype = Object.getPrototypeOf(input)
  if (prototype !== Object.prototype && prototype !== null)
    throw new ConfigFormValueReferenceError('CONFIG_FORM_VALUE_REMAP_INVALID', 'Reference remap must be a plain object.', '$maps')
  const entries = readDataEntries(input, '$maps')
  const allowed = new Set(['fields', 'variables'])
  for (const [key] of entries) {
    if (!allowed.has(key))
      throw new ConfigFormValueReferenceError('CONFIG_FORM_VALUE_REMAP_INVALID', `Unknown remap key: ${key}.`, appendProperty('$maps', key))
  }
  const values = new Map(entries)
  return {
    fields: normalizeIdMap(values.get('fields'), '$maps.fields'),
    variables: normalizeIdMap(values.get('variables'), '$maps.variables'),
  }
}

function normalizeIdMap(value: unknown, path: string): ReadonlyMap<string, string> {
  if (value === undefined)
    return new Map()
  let entries: Array<[unknown, unknown]>
  if (value instanceof Map) {
    entries = [...value.entries()]
  }
  else {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      throw new ConfigFormValueReferenceError('CONFIG_FORM_VALUE_REMAP_INVALID', 'Identity remap must be a Map or plain object.', path)
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null)
      throw new ConfigFormValueReferenceError('CONFIG_FORM_VALUE_REMAP_INVALID', 'Identity remap must be a Map or plain object.', path)
    entries = readDataEntries(value, path)
  }
  if (entries.length > CONFIG_FORM_VALUE_MAX_VISITS)
    throw new ConfigFormValueReferenceError('CONFIG_FORM_VALUE_VISIT_LIMIT_EXCEEDED', 'Identity remap is too large.', path)
  const result = new Map<string, string>()
  entries.forEach(([from, to], index) => {
    const entryPath = `${path}[${index}]`
    if (typeof from !== 'string' || typeof to !== 'string')
      throw new ConfigFormValueReferenceError('CONFIG_FORM_VALUE_REMAP_INVALID', 'Identity remap entries must be string pairs.', entryPath)
    assertIdentity(from, entryPath)
    assertIdentity(to, entryPath)
    result.set(from, to)
  })
  return result
}

function readIdentity(value: unknown, state: TraversalState, path: string, depth: number): string {
  enterValue(state, depth, path)
  if (typeof value !== 'string')
    throw invalidReference('Reference identity must be a non-empty string.', path)
  assertIdentity(value, path)
  return value
}

function assertIdentity(value: string, path: string): void {
  if (value.trim().length === 0 || UNSAFE_KEYS.has(value))
    throw invalidReference('Reference identity must be a safe non-empty string.', path)
}

function assertSafePathSegment(value: string, path: string): void {
  if (UNSAFE_KEYS.has(value)) {
    throw new ConfigFormValueReferenceError(
      'CONFIG_FORM_VALUE_UNSAFE_KEY',
      `Unsafe value key: ${value}.`,
      path,
    )
  }
}

function assertReferenceKeys(
  entries: ReadonlyArray<readonly [string, unknown]>,
  required: readonly string[],
  path: string,
  optional: readonly string[] = [],
): void {
  const keys = new Set(entries.map(([key]) => key))
  for (const key of required) {
    if (!keys.has(key))
      throw invalidReference(`Value reference requires "${key}".`, appendProperty(path, key))
  }
  const allowed = new Set([...required, ...optional])
  for (const key of keys) {
    if (!allowed.has(key))
      throw invalidReference(`Unknown value reference property: ${key}.`, appendProperty(path, key))
  }
}

function assertContainer(value: object, path: string, array: boolean): void {
  const prototype = Object.getPrototypeOf(value)
  const valid = array
    ? prototype === Array.prototype
    : prototype === Object.prototype || prototype === null
  if (!valid)
    throw invalidInput('Value input contains a non-JSON object.', path)
}

function readDataEntries(value: object, path: string): Array<[string, unknown]> {
  const keys = Reflect.ownKeys(value)
  const entries: Array<[string, unknown]> = []
  for (const key of keys) {
    if (Array.isArray(value) && key === 'length')
      continue
    if (typeof key !== 'string')
      throw invalidInput('Value input cannot contain symbol keys.', path)
    assertSafePathSegment(key, appendProperty(path, key))
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
      throw invalidInput('Value input properties must be enumerable data properties.', appendProperty(path, key))
    entries.push([key, descriptor.value])
  }
  if (Array.isArray(value)) {
    if (entries.length !== value.length || entries.some(([key], index) => key !== String(index)))
      throw invalidInput('Value input arrays must be dense and cannot have extra properties.', path)
  }
  return entries
}

function assertContext(context: ConfigFormValueContext): void {
  if (typeof context !== 'object' || context === null || Array.isArray(context))
    throw invalidInput('Value context must be an object.', '$context')
  for (const key of ['fields', 'variables'] as const) {
    const value = context[key]
    if (value !== undefined && (typeof value !== 'object' || value === null || Array.isArray(value)))
      throw invalidInput(`Value context ${key} must be an object.`, `$context.${key}`)
  }
  if (context.resolveField !== undefined && typeof context.resolveField !== 'function')
    throw invalidInput('Value context resolveField must be a function.', '$context.resolveField')
}

function expressionRootMap(name: string, maps: NormalizedRemap): ReadonlyMap<string, string> | undefined {
  if (name === '$fields')
    return maps.fields
  if (name === '$variables')
    return maps.variables
  return undefined
}

function dynamicExpressionReference(root: string, path: string): ConfigFormValueReferenceError {
  return new ConfigFormValueReferenceError(
    'CONFIG_FORM_VALUE_EXPRESSION_REFERENCE_DYNAMIC',
    `Expression root "${root}" must use a static string identity.`,
    path,
  )
}

function missingReference(kind: string, id: string, path: string): ConfigFormValueReferenceError {
  return new ConfigFormValueReferenceError(
    'CONFIG_FORM_VALUE_REFERENCE_MISSING',
    `Missing ${kind} reference "${id}".`,
    path,
  )
}

function invalidInput(message: string, path: string): ConfigFormValueReferenceError {
  return new ConfigFormValueReferenceError('CONFIG_FORM_VALUE_INPUT_INVALID', message, path)
}

function invalidReference(message: string, path: string): ConfigFormValueReferenceError {
  return new ConfigFormValueReferenceError('CONFIG_FORM_VALUE_REFERENCE_INVALID', message, path)
}

function readErrorCode(value: unknown): string | undefined {
  return typeof value === 'object' && value !== null && 'code' in value && typeof value.code === 'string'
    ? value.code
    : undefined
}

function appendProperty(path: string, key: string): string {
  return /^[A-Z_$][\w$]*$/i.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`
}

function appendIndex(path: string, index: number): string {
  return `${path}[${index}]`
}

function isArrayIndex(value: string): boolean {
  return /^(?:0|[1-9]\d*)$/.test(value) && Number(value) < 4_294_967_295
}
