import type {
  ContractResult,
  CreateDatasetFromRowsInput,
  DatasetPathReadResult,
  DatasetProjection,
  DatasetTransferEnvelopeV1,
  DatasetViewQuery,
  DatasetViewResult,
  DeepReadonly,
  ModelDiagnostic,
  ModelJsonObject,
  ModelJsonValue,
  ProjectDataset,
  SafeExpression,
  SafeExpressionNode,
} from '../types'
import { z } from 'zod'
import { DATASET_TRANSFER_VERSION } from '../constants'
import {
  projectDatasetSchema,
  safeExpressionSchema,
} from '../schemas'

const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_PATH_SEGMENTS = 32
const MISSING = Symbol('dataset-path-missing')
type DatasetValue = ModelJsonValue | typeof MISSING

const datasetTransferEnvelopeSchema = z.object({
  kind: z.literal('config-form-dataset'),
  version: z.literal(DATASET_TRANSFER_VERSION),
  dataset: projectDatasetSchema,
}).strict()

export function createDatasetFromRows(
  input: CreateDatasetFromRowsInput,
): ContractResult<ProjectDataset> {
  if (!Array.isArray(input.rows))
    return datasetFailure(input.id, 'Dataset rows must be a JSON object array.', ['rows'], 'root_not_array')

  const parsed = parseDataset({
    id: input.id,
    name: input.name,
    ...(input.description === undefined ? {} : { description: input.description }),
    rows: input.rows,
  }, input.id)
  return parsed.success ? success(structuredClone(parsed.data)) : parsed
}

export function writeDatasetTransfer(
  dataset: DeepReadonly<ProjectDataset>,
): ContractResult<DatasetTransferEnvelopeV1> {
  const parsed = parseDataset(dataset, dataset.id)
  if (!parsed.success)
    return parsed
  return success({
    kind: 'config-form-dataset',
    version: DATASET_TRANSFER_VERSION,
    dataset: structuredClone(parsed.data),
  })
}

export function readDatasetTransfer(
  input: unknown,
): ContractResult<DatasetTransferEnvelopeV1> {
  const versionDiagnostic = inspectVersion(input, 'DatasetTransfer', DATASET_TRANSFER_VERSION)
  if (versionDiagnostic)
    return failure(versionDiagnostic)

  let parsed: ReturnType<typeof datasetTransferEnvelopeSchema.safeParse>
  try {
    parsed = datasetTransferEnvelopeSchema.safeParse(input)
  }
  catch {
    return datasetFailure(undefined, 'Dataset transfer structure cannot be inspected safely.', [], 'structure_uninspectable')
  }
  if (!parsed.success) {
    const datasetId = readStringProperty(input, ['dataset', 'id'])
    return {
      success: false,
      diagnostics: parsed.error.issues.map(issue => ({
        code: 'dataset_rows_invalid',
        message: issue.message,
        path: issue.path,
        ...(datasetId ? { datasetId } : {}),
        context: { reason: 'transfer_structure_invalid' },
      })),
    }
  }
  return success(structuredClone(parsed.data))
}

export function readDatasetPath(
  row: DeepReadonly<ModelJsonObject>,
  path: readonly string[],
): DatasetPathReadResult {
  const value = readPath(row, path)
  return value === MISSING
    ? { found: false }
    : { found: true, value: structuredClone(value) }
}

export function projectDatasetRows(
  dataset: DeepReadonly<ProjectDataset>,
  projection: DeepReadonly<DatasetProjection>,
): ContractResult<readonly ModelJsonObject[]> {
  const datasetResult = parseDataset(dataset, dataset.id)
  if (!datasetResult.success)
    return datasetResult
  const projectionResult = parseDataset({ ...structuredClone(datasetResult.data), defaultProjection: structuredClone(projection) }, dataset.id)
  if (!projectionResult.success)
    return projectionFailure(dataset.id, 'Dataset projection is invalid.', ['projection'], 'projection_contract_invalid')
  return projectRows(datasetResult.data.rows, projection, dataset.id)
}

export function queryDatasetView(
  dataset: DeepReadonly<ProjectDataset>,
  projection: DeepReadonly<DatasetProjection>,
  query: DeepReadonly<DatasetViewQuery> = {},
): ContractResult<DatasetViewResult<ModelJsonObject>> {
  const datasetResult = parseDataset(dataset, dataset.id)
  if (!datasetResult.success)
    return datasetResult
  const projectionResult = parseDataset({ ...structuredClone(datasetResult.data), defaultProjection: structuredClone(projection) }, dataset.id)
  if (!projectionResult.success)
    return projectionFailure(dataset.id, 'Dataset projection is invalid.', ['projection'], 'projection_contract_invalid')

  const queryDiagnostic = validateQuery(query, dataset.id)
  if (queryDiagnostic)
    return failure(queryDiagnostic)

  let rows = datasetResult.data.rows.map((row, index) => ({ row, index }))
  if (query.filter) {
    const expression = safeExpressionSchema.safeParse(query.filter)
    if (!expression.success)
      return projectionFailure(dataset.id, 'Dataset filter expression is invalid.', ['query', 'filter'], 'filter_contract_invalid')
    if (hasNonItemReference(expression.data.ast)) {
      return projectionFailure(
        dataset.id,
        'Dataset filter expressions may only reference the current item.',
        ['query', 'filter'],
        'filter_scope_invalid',
      )
    }
    const filtered: typeof rows = []
    for (const entry of rows) {
      const result = evaluateFilter(expression.data, entry.row)
      if (!result.success) {
        return projectionFailure(
          dataset.id,
          result.message,
          ['rows', entry.index],
          'filter_evaluation_invalid',
        )
      }
      if (result.value)
        filtered.push(entry)
    }
    rows = filtered
  }

  if (query.sort?.length) {
    const rules = query.sort
    rows.sort((left, right) => {
      for (const rule of rules) {
        const compared = compareDatasetValues(
          readPath(left.row, rule.path),
          readPath(right.row, rule.path),
        )
        if (compared !== 0)
          return rule.direction === 'asc' ? compared : -compared
      }
      return left.index - right.index
    })
  }

  const total = rows.length
  const projected = projectRows(rows.map(entry => entry.row), projection, dataset.id)
  if (!projected.success)
    return projected

  const items = query.page
    ? projected.data.slice(query.page.index * query.page.size, (query.page.index + 1) * query.page.size)
    : [...projected.data]
  return success(Object.freeze({
    items: deepFreeze(items.map(item => structuredClone(item))),
    total,
  }))
}

function parseDataset(input: unknown, datasetId?: string): ContractResult<ProjectDataset> {
  let parsed: ReturnType<typeof projectDatasetSchema.safeParse>
  try {
    parsed = projectDatasetSchema.safeParse(input)
  }
  catch {
    return datasetFailure(datasetId, 'Dataset structure cannot be inspected safely.', [], 'structure_uninspectable')
  }
  if (parsed.success)
    return success(parsed.data)
  return {
    success: false,
    diagnostics: parsed.error.issues.map(issue => ({
      code: 'dataset_rows_invalid',
      message: issue.message,
      path: issue.path,
      ...(datasetId ? { datasetId } : {}),
      context: { reason: 'dataset_contract_invalid' },
    })),
  }
}

function projectRows(
  rows: readonly ModelJsonObject[],
  projection: DeepReadonly<DatasetProjection>,
  datasetId: string,
): ContractResult<readonly ModelJsonObject[]> {
  const result: ModelJsonObject[] = []
  const optionValues = new Set<string | number>()
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!
    if (projection.kind === 'options') {
      const value = readPath(row, projection.valuePath)
      if (value === MISSING || (typeof value !== 'string' && typeof value !== 'number')) {
        return projectionFailure(
          datasetId,
          'Dataset option values must resolve to a string or number.',
          ['rows', index, ...projection.valuePath],
          value === MISSING ? 'option_value_missing' : 'option_value_type_invalid',
        )
      }
      if (optionValues.has(value)) {
        return projectionFailure(
          datasetId,
          'Dataset option values must be unique.',
          ['rows', index, ...projection.valuePath],
          'option_value_duplicate',
        )
      }
      optionValues.add(value)
      const label = readPath(row, projection.labelPath)
      const disabled = projection.disabledPath === undefined
        ? MISSING
        : readPath(row, projection.disabledPath)
      result.push({
        label: label === MISSING || label === null ? '' : displayValue(label),
        value,
        ...(typeof disabled === 'boolean' ? { disabled } : {}),
      })
      continue
    }
    if (projection.kind === 'table') {
      const rowKey = readPath(row, projection.rowKeyPath)
      const item: ModelJsonObject = {
        rowKey: rowKey === MISSING ? null : structuredClone(rowKey),
      }
      for (const column of projection.columns) {
        const value = readPath(row, column.valuePath)
        item[column.key] = value === MISSING ? null : structuredClone(value)
      }
      result.push(item)
      continue
    }
    const itemKey = readPath(row, projection.itemKeyPath)
    const item: ModelJsonObject = {
      itemKey: itemKey === MISSING ? null : structuredClone(itemKey),
    }
    if (projection.titlePath) {
      const title = readPath(row, projection.titlePath)
      item.title = title === MISSING ? null : structuredClone(title)
    }
    if (projection.descriptionPath) {
      const description = readPath(row, projection.descriptionPath)
      item.description = description === MISSING ? null : structuredClone(description)
    }
    result.push(item)
  }
  return success(deepFreeze(result))
}

function validateQuery(
  query: DeepReadonly<DatasetViewQuery>,
  datasetId: string,
): ModelDiagnostic | undefined {
  if (query.sort) {
    for (let index = 0; index < query.sort.length; index += 1) {
      const rule = query.sort[index]!
      if (!validPath(rule.path) || (rule.direction !== 'asc' && rule.direction !== 'desc')) {
        return projectionDiagnostic(
          datasetId,
          'Dataset sort rule is invalid.',
          ['query', 'sort', index],
          'sort_rule_invalid',
        )
      }
    }
  }
  if (query.page && (!Number.isInteger(query.page.index) || query.page.index < 0
    || !Number.isInteger(query.page.size) || query.page.size <= 0)) {
    return projectionDiagnostic(
      datasetId,
      'Dataset page index must be zero-based and size must be a positive integer.',
      ['query', 'page'],
      'page_invalid',
    )
  }
}

function readPath(value: unknown, path: readonly string[]): DatasetValue {
  if (!validPath(path))
    return MISSING
  let current: unknown = value
  for (const segment of path) {
    if (typeof current !== 'object' || current === null || !Object.hasOwn(current, segment))
      return MISSING
    current = (current as Record<string, unknown>)[segment]
  }
  return isJsonValue(current) ? current : MISSING
}

function validPath(path: readonly string[]): boolean {
  return path.length <= MAX_PATH_SEGMENTS
    && path.every(segment => segment.length > 0 && segment.length <= 128 && !FORBIDDEN_PATH_SEGMENTS.has(segment))
}

function evaluateFilter(
  expression: SafeExpression,
  item: ModelJsonObject,
): { success: true, value: boolean } | { success: false, message: string } {
  try {
    const value = requirePresent(evaluateNode(expression.ast, item), 'result')
    if (typeof value !== 'boolean')
      throw new TypeError('Dataset filter expression must evaluate to a boolean.')
    return { success: true, value }
  }
  catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Dataset filter expression failed.',
    }
  }
}

function hasNonItemReference(node: SafeExpressionNode): boolean {
  switch (node.kind) {
    case 'literal': return false
    case 'reference': return node.scope !== 'item'
    case 'array': return node.items.some(hasNonItemReference)
    case 'unary': return hasNonItemReference(node.operand)
    case 'binary': return hasNonItemReference(node.left) || hasNonItemReference(node.right)
    case 'conditional':
      return hasNonItemReference(node.test)
        || hasNonItemReference(node.consequent)
        || hasNonItemReference(node.alternate)
    case 'call': return node.args.some(hasNonItemReference)
  }
}

function evaluateNode(node: SafeExpressionNode, item: ModelJsonObject): DatasetValue {
  switch (node.kind) {
    case 'literal': return structuredClone(node.value)
    case 'reference': return node.scope === 'item' ? readPath(item, node.path) : MISSING
    case 'array': return node.items.map(child => structuredClone(requirePresent(evaluateNode(child, item), 'array')))
    case 'unary': {
      const value = evaluateNode(node.operand, item)
      if (node.operator === '!')
        return !requireBoolean(value, '!')
      const number = requireNumber(value, node.operator)
      return finiteNumber(node.operator === '+' ? number : -number, node.operator)
    }
    case 'binary': return evaluateBinary(node, item)
    case 'conditional':
      return requireBoolean(evaluateNode(node.test, item), 'conditional')
        ? evaluateNode(node.consequent, item)
        : evaluateNode(node.alternate, item)
    case 'call': return evaluateCall(node, item)
  }
}

function evaluateBinary(
  node: Extract<SafeExpressionNode, { kind: 'binary' }>,
  item: ModelJsonObject,
): DatasetValue {
  const left = evaluateNode(node.left, item)
  if (node.operator === '&&')
    return requireBoolean(left, '&&') ? requireBoolean(evaluateNode(node.right, item), '&&') : false
  if (node.operator === '||')
    return requireBoolean(left, '||') ? true : requireBoolean(evaluateNode(node.right, item), '||')

  const right = evaluateNode(node.right, item)
  if (node.operator === '==' || node.operator === '!=') {
    const equal = jsonEqual(requirePresent(left, node.operator), requirePresent(right, node.operator))
    return node.operator === '==' ? equal : !equal
  }
  if (node.operator === '>' || node.operator === '>=' || node.operator === '<' || node.operator === '<=') {
    const leftValue = requirePresent(left, node.operator)
    const rightValue = requirePresent(right, node.operator)
    if ((typeof leftValue !== 'number' || typeof rightValue !== 'number')
      && (typeof leftValue !== 'string' || typeof rightValue !== 'string')) {
      throw new TypeError(`Dataset filter ${node.operator} requires two numbers or two strings.`)
    }
    switch (node.operator) {
      case '>': return leftValue > rightValue
      case '>=': return leftValue >= rightValue
      case '<': return leftValue < rightValue
      case '<=': return leftValue <= rightValue
    }
  }

  const leftNumber = requireNumber(left, node.operator)
  const rightNumber = requireNumber(right, node.operator)
  switch (node.operator) {
    case '+': return finiteNumber(leftNumber + rightNumber, '+')
    case '-': return finiteNumber(leftNumber - rightNumber, '-')
    case '*': return finiteNumber(leftNumber * rightNumber, '*')
    case '/':
      if (rightNumber === 0)
        throw new TypeError('Dataset filter division by zero is invalid.')
      return finiteNumber(leftNumber / rightNumber, '/')
    case '%':
      if (rightNumber === 0)
        throw new TypeError('Dataset filter modulo by zero is invalid.')
      return finiteNumber(leftNumber % rightNumber, '%')
  }
}

function evaluateCall(
  node: Extract<SafeExpressionNode, { kind: 'call' }>,
  item: ModelJsonObject,
): ModelJsonValue {
  if (node.callee === 'coalesce') {
    for (const argument of node.args) {
      const value = evaluateNode(argument, item)
      if (value !== MISSING && value !== null)
        return structuredClone(value)
    }
    return null
  }
  const values = node.args.map(argument => requirePresent(evaluateNode(argument, item), node.callee))
  switch (node.callee) {
    case 'length':
      if (typeof values[0] !== 'string' && !Array.isArray(values[0]))
        throw new TypeError('Dataset filter length requires one string or array.')
      return values[0].length
    case 'trim':
    case 'lower':
    case 'upper': {
      const value = values[0]
      if (typeof value !== 'string')
        throw new TypeError(`Dataset filter ${node.callee} requires one string.`)
      return node.callee === 'trim' ? value.trim() : node.callee === 'lower' ? value.toLowerCase() : value.toUpperCase()
    }
    case 'startsWith':
    case 'endsWith': {
      const [value, search] = values
      if (typeof value !== 'string' || typeof search !== 'string')
        throw new TypeError(`Dataset filter ${node.callee} requires two strings.`)
      return node.callee === 'startsWith' ? value.startsWith(search) : value.endsWith(search)
    }
    case 'includes': {
      const [value, search] = values
      if (typeof value === 'string') {
        if (typeof search !== 'string')
          throw new TypeError('Dataset filter includes requires string/string or array/JSON-value.')
        return value.includes(search)
      }
      if (Array.isArray(value))
        return value.some(entry => jsonEqual(entry, search!))
      throw new TypeError('Dataset filter includes requires string/string or array/JSON-value.')
    }
  }
}

function requirePresent(value: DatasetValue, operation: string): ModelJsonValue {
  if (value === MISSING)
    throw new TypeError(`Dataset filter ${operation} cannot consume a missing value.`)
  return value
}

function requireBoolean(value: DatasetValue, operation: string): boolean {
  const present = requirePresent(value, operation)
  if (typeof present !== 'boolean')
    throw new TypeError(`Dataset filter ${operation} requires a boolean.`)
  return present
}

function requireNumber(value: DatasetValue, operation: string): number {
  const present = requirePresent(value, operation)
  if (typeof present !== 'number' || !Number.isFinite(present))
    throw new TypeError(`Dataset filter ${operation} requires a finite number.`)
  return present
}

function finiteNumber(value: number, operation: string): number {
  if (!Number.isFinite(value))
    throw new TypeError(`Dataset filter ${operation} produced a non-finite result.`)
  return value
}

function compareDatasetValues(left: DatasetValue, right: DatasetValue): number {
  if (left === MISSING || right === MISSING)
    return left === right ? 0 : left === MISSING ? -1 : 1
  const leftRank = valueRank(left)
  const rightRank = valueRank(right)
  if (leftRank !== rightRank)
    return leftRank - rightRank
  if (typeof left === 'number' && typeof right === 'number')
    return left === right ? 0 : left < right ? -1 : 1
  if (typeof left === 'string' && typeof right === 'string')
    return left === right ? 0 : left < right ? -1 : 1
  if (typeof left === 'boolean' && typeof right === 'boolean')
    return left === right ? 0 : left ? 1 : -1
  const leftSerialized = stableStringify(left)
  const rightSerialized = stableStringify(right)
  return leftSerialized === rightSerialized ? 0 : leftSerialized < rightSerialized ? -1 : 1
}

function valueRank(value: ModelJsonValue): number {
  if (value === null)
    return 0
  if (typeof value === 'boolean')
    return 1
  if (typeof value === 'number')
    return 2
  if (typeof value === 'string')
    return 3
  return Array.isArray(value) ? 4 : 5
}

function stableStringify(value: ModelJsonValue): string {
  if (Array.isArray(value))
    return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key]!)}`).join(',')}}`
  return JSON.stringify(value)
}

function jsonEqual(left: ModelJsonValue, right: ModelJsonValue): boolean {
  return stableStringify(left) === stableStringify(right)
}

function displayValue(value: ModelJsonValue): string {
  if (typeof value === 'string')
    return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return stableStringify(value)
}

function isJsonValue(value: unknown): value is ModelJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true
  if (typeof value === 'number')
    return Number.isFinite(value)
  if (Array.isArray(value))
    return value.every(isJsonValue)
  if (!value || typeof value !== 'object')
    return false
  return Object.keys(value).every(key => !FORBIDDEN_PATH_SEGMENTS.has(key)
    && isJsonValue((value as Record<string, unknown>)[key]))
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

function inspectVersion(
  input: unknown,
  contract: string,
  expected: number,
): ModelDiagnostic | undefined {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || !Object.hasOwn(input, 'version')
      || (input as { version?: unknown }).version !== expected) {
      const received = input && typeof input === 'object' && !Array.isArray(input) && Object.hasOwn(input, 'version')
        ? (input as { version?: unknown }).version
        : undefined
      return {
        code: 'unsupported_contract_version',
        message: `${contract} requires version ${expected}.`,
        path: ['version'],
        context: { contract, expected, received: received ?? null },
      }
    }
  }
  catch {
    return {
      code: 'dataset_rows_invalid',
      message: 'Dataset transfer structure cannot be inspected safely.',
      path: [],
      context: { reason: 'structure_uninspectable' },
    }
  }
}

function readStringProperty(input: unknown, path: readonly string[]): string | undefined {
  let current = input
  try {
    for (const segment of path) {
      if (!current || typeof current !== 'object' || !Object.hasOwn(current, segment))
        return undefined
      current = (current as Record<string, unknown>)[segment]
    }
  }
  catch {
    return undefined
  }
  return typeof current === 'string' ? current : undefined
}

function success<T>(data: T): ContractResult<T> {
  return { success: true, data, diagnostics: [] }
}

function failure<T = never>(diagnostic: ModelDiagnostic): ContractResult<T> {
  return { success: false, diagnostics: [diagnostic] }
}

function datasetFailure<T = never>(
  datasetId: string | undefined,
  message: string,
  path: Array<string | number>,
  reason: string,
): ContractResult<T> {
  return failure({
    code: 'dataset_rows_invalid',
    message,
    path,
    ...(datasetId ? { datasetId } : {}),
    context: { reason },
  })
}

function projectionDiagnostic(
  datasetId: string,
  message: string,
  path: Array<string | number>,
  reason: string,
): ModelDiagnostic {
  return {
    code: 'dataset_projection_invalid',
    message,
    path,
    datasetId,
    context: { reason },
  }
}

function projectionFailure<T = never>(
  datasetId: string,
  message: string,
  path: Array<string | number>,
  reason: string,
): ContractResult<T> {
  return failure(projectionDiagnostic(datasetId, message, path, reason))
}
