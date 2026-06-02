import { parse } from '@babel/parser'
import { ConfigFormDevtoolsPluginError } from '../types'

export interface AstNode {
  type: string
  start?: number | null
  end?: number | null
  loc?: {
    start: {
      line: number
      column: number
    }
  } | null
  [key: string]: unknown
}

export interface ImportDeclarationNode extends AstNode {
  source: AstNode & { value?: unknown }
  specifiers: AstNode[]
}

export interface ImportSpecifierNode extends AstNode {
  imported?: AstNode & { name?: string }
  local?: AstNode & { name?: string }
}

export interface CallExpressionNode extends AstNode {
  callee?: AstNode & { name?: string }
  arguments?: AstNode[]
}

export interface ObjectExpressionNode extends AstNode {
  properties?: AstNode[]
}

export interface ObjectPropertyNode extends AstNode {
  key?: AstNode
  value?: AstNode
}

export interface ArrayExpressionNode extends AstNode {
  elements?: Array<AstNode | null>
}

export interface InlineFunctionExpressionNode extends AstNode {
  type: 'ArrowFunctionExpression' | 'FunctionExpression'
}

/** 解析 JS/TS/JSX/TSX 脚本内容。 */
export function parseScript(content: string, id: string): AstNode {
  try {
    return parse(content, {
      errorRecovery: false,
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
      sourceFilename: id,
      sourceType: 'module',
    }) as unknown as AstNode
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new ConfigFormDevtoolsPluginError(`[config-form-devtools] Failed to parse ${id}: ${message}`)
  }
}

/** 判断 import specifier 是否导入了 defineField。 */
export function isImportedDefineField(node: AstNode): node is ImportSpecifierNode {
  return node.type === 'ImportSpecifier'
    && (node as ImportSpecifierNode).imported?.type === 'Identifier'
    && (node as ImportSpecifierNode).imported?.name === 'defineField'
    && typeof (node as ImportSpecifierNode).local?.name === 'string'
}

/**
 * 收集从目标 ConfigForm 包导入的 defineField 本地名称。
 *
 * 支持别名导入；非目标包的同名函数不会参与源码注入。
 */
export function collectDefineFieldLocals(ast: AstNode, packageNames: string[]): Set<string> {
  const locals = new Set<string>()
  const body = (ast as { program?: { body?: AstNode[] } }).program?.body ?? []

  for (const node of body) {
    if (node.type !== 'ImportDeclaration')
      continue

    const declaration = node as ImportDeclarationNode
    if (typeof declaration.source.value !== 'string')
      continue
    if (!packageNames.includes(declaration.source.value))
      continue

    for (const specifier of declaration.specifiers) {
      if (isImportedDefineField(specifier))
        locals.add(specifier.local?.name ?? 'defineField')
    }
  }

  return locals
}

/** 读取对象属性 key 的静态名称，仅支持 identifier 和字符串字面量。 */
export function getObjectKeyName(node: AstNode): string | undefined {
  if (node.type === 'Identifier' && typeof (node as { name?: unknown }).name === 'string')
    return (node as unknown as { name: string }).name
  if (node.type === 'StringLiteral' && typeof (node as { value?: unknown }).value === 'string')
    return (node as unknown as { value: string }).value
  return undefined
}

/** 判断 defineField 对象是否已经显式包含 __source 配置。 */
export function hasSourceProperty(node: ObjectExpressionNode): boolean {
  return (node.properties ?? []).some((property) => {
    if (property.type !== 'ObjectProperty' && property.type !== 'ObjectMethod')
      return false
    const key = (property as { key?: AstNode }).key
    return key ? getObjectKeyName(key) === '__source' : false
  })
}

/** render 函数只接受标准函数表达式或箭头函数，避免改写运行期动态引用。 */
export function isInlineFunctionExpression(node: AstNode | undefined): node is InlineFunctionExpressionNode {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression'
}

/** 判断对象属性节点并保留 key/value 类型信息。 */
export function isObjectProperty(node: AstNode): node is ObjectPropertyNode {
  return node.type === 'ObjectProperty'
}

/**
 * 深度遍历 Babel AST。
 *
 * 跳过位置和注释元数据，避免递归进入非节点对象造成无意义扫描。
 */
export function walkAst(node: AstNode, visitor: (node: AstNode) => void) {
  visitor(node)

  for (const [key, value] of Object.entries(node)) {
    if (
      key === 'loc'
      || key === 'start'
      || key === 'end'
      || key === 'extra'
      || key === 'comments'
      || key === 'leadingComments'
      || key === 'innerComments'
      || key === 'trailingComments'
    ) {
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && typeof (item as AstNode).type === 'string')
          walkAst(item as AstNode, visitor)
      }
    }
    else if (value && typeof value === 'object' && typeof (value as AstNode).type === 'string') {
      walkAst(value as AstNode, visitor)
    }
  }
}
