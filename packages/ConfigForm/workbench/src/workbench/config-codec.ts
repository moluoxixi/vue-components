import type {
  DesignerDiagnostic,
  DesignerDocument,
  DesignerNode,
} from '@moluoxixi/config-form-designer'
import type { WorkspaceAdapter } from '../project'
import { parse } from '@babel/parser'
import { parseDesignerDocument } from '@moluoxixi/config-form-designer'

export const DESIGNER_EXTENSION_KEY = 'mx.config-form-designer'

const COMPONENT_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'auto-complete': 'text',
  'checkbox': 'boolean',
  'date': 'text',
  'input': 'text',
  'input-number': 'number',
  'password': 'text',
  'radio': 'select',
  'rate': 'number',
  'search': 'text',
  'select': 'select',
  'slider': 'number',
  'switch': 'boolean',
  'textarea': 'textarea',
  'time': 'text',
})

const MATERIAL_BY_COMPONENT: Readonly<Record<string, string>> = Object.freeze({
  boolean: 'switch',
  number: 'input-number',
  select: 'select',
  text: 'input',
  textarea: 'textarea',
})

interface AstNode {
  [key: string]: unknown
  type: string
}

interface DesignerMetadata {
  conditions?: unknown
  hasDefaultValue?: unknown
  id?: unknown
  material?: unknown
  validation?: unknown
}

interface ParsedConfigExports {
  fields: unknown[]
  form: Record<string, unknown>
  initialValues: Record<string, unknown>
}

export type DesignerConfigParseResult
  = | { document: DesignerDocument, initialValues: Record<string, unknown>, success: true }
    | { diagnostics: DesignerDiagnostic[], message: string, success: false }

function isAstNode(value: unknown): value is AstNode {
  return !!value && typeof value === 'object' && 'type' in value && typeof value.type === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function hasOwn(value: object, key: string): boolean {
  return Object.hasOwn(value, key)
}

function unwrapExpression(node: AstNode): AstNode {
  let current = node
  while (
    ['ParenthesizedExpression', 'TSAsExpression', 'TSNonNullExpression', 'TSSatisfiesExpression', 'TypeCastExpression']
      .includes(current.type)
  ) {
    if (!isAstNode(current.expression))
      throw new Error('Config contains an invalid TypeScript expression.')
    current = current.expression
  }
  return current
}

function objectPropertyKey(node: AstNode): string {
  if (node.computed)
    throw new Error('Computed object keys are not supported in Config.')
  if (!isAstNode(node.key))
    throw new Error('Config contains an invalid object key.')
  if (node.key.type === 'Identifier' && typeof node.key.name === 'string')
    return node.key.name
  if ((node.key.type === 'StringLiteral' || node.key.type === 'NumericLiteral') && (typeof node.key.value === 'string' || typeof node.key.value === 'number'))
    return String(node.key.value)
  throw new Error('Config object keys must be static identifiers or literals.')
}

function parseStaticObject(node: AstNode): Record<string, unknown> {
  const expression = unwrapExpression(node)
  if (expression.type !== 'ObjectExpression' || !Array.isArray(expression.properties))
    throw new Error('Config value must be a static object.')

  const result: Record<string, unknown> = {}
  for (const property of expression.properties) {
    if (!isAstNode(property) || property.type !== 'ObjectProperty' || !isAstNode(property.value))
      throw new Error('Object methods, shorthand properties, and spreads are not supported in Config.')
    const key = objectPropertyKey(property)
    if (['__proto__', 'constructor', 'prototype'].includes(key))
      throw new Error(`Unsafe Config object key "${key}" is not supported.`)
    result[key] = parseStaticValue(property.value)
  }
  return result
}

function parseDefineFieldCall(node: AstNode): Record<string, unknown> {
  const expression = unwrapExpression(node)
  if (expression.type !== 'CallExpression' || !isAstNode(expression.callee) || expression.callee.type !== 'Identifier' || expression.callee.name !== 'defineField')
    throw new Error('Every fields entry must call defineField({...}).')
  if (!Array.isArray(expression.arguments) || expression.arguments.length !== 1 || !isAstNode(expression.arguments[0]))
    throw new Error('defineField must receive exactly one static object.')
  return parseStaticObject(expression.arguments[0])
}

function parseStaticArray(node: AstNode): unknown[] {
  const expression = unwrapExpression(node)
  if (expression.type !== 'ArrayExpression' || !Array.isArray(expression.elements))
    throw new Error('Config value must be a static array.')
  return expression.elements.map((element) => {
    if (!isAstNode(element))
      throw new Error('Sparse arrays and spreads are not supported in Config.')
    return parseStaticValue(element)
  })
}

function parseStaticValue(node: AstNode): unknown {
  const expression = unwrapExpression(node)
  switch (expression.type) {
    case 'ArrayExpression':
      return parseStaticArray(expression)
    case 'BooleanLiteral':
    case 'NumericLiteral':
    case 'StringLiteral':
      return expression.value
    case 'NullLiteral':
      return null
    case 'ObjectExpression':
      return parseStaticObject(expression)
    case 'UnaryExpression': {
      if ((expression.operator !== '-' && expression.operator !== '+') || !isAstNode(expression.argument))
        break
      const argument = unwrapExpression(expression.argument)
      if (argument.type === 'NumericLiteral' && typeof argument.value === 'number')
        return expression.operator === '-' ? -argument.value : argument.value
      break
    }
    case 'CallExpression':
      return parseDefineFieldCall(expression)
  }
  throw new Error('Config only supports JSON-safe values and defineField({...}) calls.')
}

function exportedConstInitializers(program: AstNode): Map<string, AstNode> {
  const exports = new Map<string, AstNode>()
  if (!Array.isArray(program.body))
    return exports
  for (const statement of program.body) {
    if (!isAstNode(statement) || statement.type !== 'ExportNamedDeclaration' || !isAstNode(statement.declaration))
      continue
    const declaration = statement.declaration
    if (declaration.type !== 'VariableDeclaration' || declaration.kind !== 'const' || !Array.isArray(declaration.declarations))
      continue
    for (const declarator of declaration.declarations) {
      if (!isAstNode(declarator) || !isAstNode(declarator.id) || declarator.id.type !== 'Identifier' || typeof declarator.id.name !== 'string' || !isAstNode(declarator.init))
        continue
      exports.set(declarator.id.name, declarator.init)
    }
  }
  return exports
}

function parseConfigExports(source: string): ParsedConfigExports {
  const ast = parse(source, {
    errorRecovery: false,
    plugins: ['typescript'],
    sourceType: 'module',
  })
  const exports = exportedConstInitializers(ast.program as unknown as AstNode)
  const formNode = exports.get('form')
  const initialValuesNode = exports.get('initialValues')
  const fieldsNode = exports.get('fields')
  if (!formNode || !initialValuesNode || !fieldsNode)
    throw new Error('Config must export static form, initialValues, and fields values.')

  const fieldsExpression = unwrapExpression(fieldsNode)
  if (fieldsExpression.type !== 'ArrayExpression' || !Array.isArray(fieldsExpression.elements))
    throw new Error('Config fields must be a static defineField array.')
  const fields = fieldsExpression.elements.map((element) => {
    if (!isAstNode(element))
      throw new Error('Config fields cannot contain sparse entries or spreads.')
    return parseDefineFieldCall(element)
  })
  return {
    fields,
    form: parseStaticObject(formNode),
    initialValues: parseStaticObject(initialValuesNode),
  }
}

function materialName(material: string): string {
  return material.split('.').at(-1) ?? material
}

function runtimeComponent(material: string, kind: DesignerNode['kind']): string {
  if (kind === 'container')
    return 'div'
  const component = COMPONENT_ALIASES[materialName(material)]
  if (!component)
    throw new Error(`Material "${material}" cannot be represented by a portable ConfigForm component.`)
  return component
}

function inferredMaterial(component: unknown, adapter: WorkspaceAdapter, kind: DesignerNode['kind']): string {
  const prefix = adapter === 'element-plus' ? 'element' : 'antd'
  if (kind === 'container')
    return `${prefix}.section`
  if (typeof component !== 'string' || !MATERIAL_BY_COMPONENT[component])
    throw new Error('A field without designer metadata must use a portable text, textarea, number, boolean, or select component.')
  return `${prefix}.${MATERIAL_BY_COMPONENT[component]}`
}

function initialValue(node: Extract<DesignerNode, { kind: 'field' }>): unknown {
  if (node.defaultValue !== undefined)
    return node.defaultValue
  const component = runtimeComponent(node.material, node.kind)
  if (component === 'boolean')
    return false
  if (component === 'number')
    return 0
  if (component === 'select' && materialName(node.material) === 'checkbox')
    return []
  return ''
}

function designerMetadata(node: DesignerNode): DesignerMetadata {
  return {
    id: node.id,
    material: node.material,
    ...('field' in node ? { hasDefaultValue: node.defaultValue !== undefined } : {}),
    ...(node.conditions === undefined ? {} : { conditions: node.conditions }),
    ...('validation' in node && node.validation !== undefined ? { validation: node.validation } : {}),
  }
}

function runtimeNode(node: DesignerNode): Record<string, unknown> {
  const base: Record<string, unknown> = {
    component: runtimeComponent(node.material, node.kind),
    ...(node.props === undefined ? {} : { props: node.props }),
    ...(node.span === undefined ? {} : { span: node.span }),
    ...(node.reactions === undefined ? {} : { reactions: node.reactions }),
    extensions: {
      ...(node.extensions ?? {}),
      [DESIGNER_EXTENSION_KEY]: designerMetadata(node),
    },
  }
  if (node.kind === 'container') {
    return {
      ...base,
      slots: Object.fromEntries(
        Object.entries(node.slots).map(([name, children]) => [name, children.map(runtimeNode)]),
      ),
    }
  }
  return {
    ...base,
    field: node.field,
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.validateOn === undefined ? {} : { validateOn: node.validateOn }),
  }
}

function quoteKey(key: string): string {
  return /^[A-Z_$][\w$]*$/i.test(key) ? key : JSON.stringify(key)
}

function formatStaticValue(value: unknown, depth = 0): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string')
    return JSON.stringify(value)
  if (Array.isArray(value)) {
    if (value.length === 0)
      return '[]'
    const indent = '  '.repeat(depth + 1)
    return `[\n${value.map(item => `${indent}${formatStaticValue(item, depth + 1)}`).join(',\n')}\n${'  '.repeat(depth)}]`
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined)
    if (entries.length === 0)
      return '{}'
    const indent = '  '.repeat(depth + 1)
    return `{\n${entries.map(([key, item]) => `${indent}${quoteKey(key)}: ${formatStaticValue(item, depth + 1)}`).join(',\n')}\n${'  '.repeat(depth)}}`
  }
  throw new Error('Designer Config contains a value that cannot be represented as static TypeScript.')
}

function formatDefineField(node: Record<string, unknown>, depth: number): string {
  const entries = Object.entries(node)
  const indent = '  '.repeat(depth + 1)
  const closingIndent = '  '.repeat(depth)
  const properties = entries.map(([key, value]) => {
    if (key !== 'slots')
      return `${indent}${quoteKey(key)}: ${formatStaticValue(value, depth + 1)}`
    if (!isRecord(value))
      throw new Error('Designer Config slots must be a static object.')
    const slotEntries = Object.entries(value).map(([slotName, children]) => {
      if (!Array.isArray(children))
        throw new Error('Designer Config slot content must be an array.')
      const childIndent = '  '.repeat(depth + 3)
      const renderedChildren = children.length === 0
        ? '[]'
        : `[\n${children.map(child => `${childIndent}${formatDefineField(child as Record<string, unknown>, depth + 3)}`).join(',\n')}\n${'  '.repeat(depth + 2)}]`
      return `${'  '.repeat(depth + 2)}${quoteKey(slotName)}: ${renderedChildren}`
    })
    return `${indent}slots: ${slotEntries.length === 0 ? '{}' : `{\n${slotEntries.join(',\n')}\n${indent}}`}`
  })
  return `defineField({\n${properties.join(',\n')}\n${closingIndent}})`
}

function valueType(value: unknown): string {
  if (value === null)
    return 'unknown'
  if (Array.isArray(value))
    return 'unknown[]'
  switch (typeof value) {
    case 'boolean':
    case 'number':
    case 'string':
      return typeof value
    case 'object':
      return 'Record<string, unknown>'
    default:
      return 'unknown'
  }
}

function formatValueModel(values: Record<string, unknown>): string {
  const entries = Object.entries(values)
  if (entries.length === 0)
    return 'export type PageFormValues = Record<string, unknown>'
  return `export interface PageFormValues {\n${entries.map(([key, value]) => `  ${quoteKey(key)}: ${valueType(value)}`).join('\n')}\n}`
}

export function formatDesignerConfig(document: DesignerDocument): string {
  const values: Record<string, unknown> = {}
  const collectValues = (nodes: DesignerNode[]): void => {
    nodes.forEach((node) => {
      if (node.kind === 'field')
        values[node.field] = initialValue(node)
      else
        Object.values(node.slots).forEach(collectValues)
    })
  }
  collectValues(document.nodes)

  const fields = document.nodes.map(runtimeNode)
  const fieldsSource = fields.length === 0
    ? '[]'
    : `[\n${fields.map(field => `  ${formatDefineField(field, 1)}`).join(',\n')}\n]`
  return `import { defineFields } from '@moluoxixi/config-form-headless'

${formatValueModel(values)}

const { defineField } = defineFields<PageFormValues>()

export const form = ${formatStaticValue(document.form)}

export const initialValues: PageFormValues = ${formatStaticValue(values)}

export const fields = ${fieldsSource}
`
}

function metadataFor(field: Record<string, unknown>): DesignerMetadata {
  if (!isRecord(field.extensions))
    return {}
  const metadata = field.extensions[DESIGNER_EXTENSION_KEY]
  return isRecord(metadata) ? metadata : {}
}

function runtimeExtensionsFor(field: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!isRecord(field.extensions))
    return undefined
  const extensions = Object.fromEntries(
    Object.entries(field.extensions).filter(([key]) => key !== DESIGNER_EXTENSION_KEY),
  )
  return Object.keys(extensions).length > 0 ? extensions : undefined
}

function generatedNodeId(field: Record<string, unknown>, path: number[]): string {
  const base = typeof field.field === 'string' && field.field.trim()
    ? field.field.trim().replace(/[^\w-]+/g, '-')
    : 'container'
  return `${base || 'node'}-${path.join('-')}`
}

function projectRuntimeNode(field: unknown, adapter: WorkspaceAdapter, initialValues: Record<string, unknown>, path: number[]): Record<string, unknown> {
  if (!isRecord(field))
    throw new Error('Every fields entry must contain a static object.')
  const metadata = metadataFor(field)
  const runtimeExtensions = runtimeExtensionsFor(field)
  const kind = typeof field.field === 'string' ? 'field' : 'container'
  const material = typeof metadata.material === 'string'
    ? metadata.material
    : inferredMaterial(field.component, adapter, kind)
  const base: Record<string, unknown> = {
    id: typeof metadata.id === 'string' && metadata.id ? metadata.id : generatedNodeId(field, path),
    kind,
    material,
    ...(isRecord(field.props) ? { props: field.props } : {}),
    ...(typeof field.span === 'number' ? { span: field.span } : {}),
    ...(Array.isArray(field.reactions) ? { reactions: field.reactions } : {}),
    ...(runtimeExtensions ? { extensions: runtimeExtensions } : {}),
    ...(isRecord(metadata.conditions) ? { conditions: metadata.conditions } : {}),
  }

  if (kind === 'container') {
    if (!isRecord(field.slots))
      throw new Error('Container defineField entries must provide a static slots object.')
    return {
      ...base,
      slots: Object.fromEntries(Object.entries(field.slots).map(([name, children], slotIndex) => {
        if (!Array.isArray(children))
          throw new Error(`Container slot "${name}" must contain a static defineField array.`)
        return [name, children.map((child, childIndex) => projectRuntimeNode(child, adapter, initialValues, [...path, slotIndex, childIndex]))]
      })),
    }
  }

  const fieldName = field.field as string
  return {
    ...base,
    field: fieldName,
    ...(typeof field.label === 'string' ? { label: field.label } : {}),
    ...(metadata.hasDefaultValue === false
      ? {}
      : hasOwn(initialValues, fieldName)
        ? { defaultValue: initialValues[fieldName] }
        : hasOwn(field, 'defaultValue')
          ? { defaultValue: field.defaultValue }
          : {}),
    ...(typeof field.validateOn === 'string' || Array.isArray(field.validateOn) ? { validateOn: field.validateOn } : {}),
    ...(isRecord(metadata.validation) ? { validation: metadata.validation } : {}),
  }
}

export function parseDesignerConfig(source: string, adapter: WorkspaceAdapter = 'element-plus'): DesignerConfigParseResult {
  try {
    const config = parseConfigExports(source)
    const input = {
      form: config.form,
      nodes: config.fields.map((field, index) => projectRuntimeNode(field, adapter, config.initialValues, [index])),
      version: 1,
    }
    const parsed = parseDesignerDocument(input)
    return parsed.success
      ? { document: parsed.data, initialValues: config.initialValues, success: true }
      : {
          diagnostics: parsed.diagnostics,
          message: parsed.diagnostics[0]?.message ?? 'Config document is invalid.',
          success: false,
        }
  }
  catch (error) {
    return {
      diagnostics: [],
      message: error instanceof Error ? error.message : String(error),
      success: false,
    }
  }
}
