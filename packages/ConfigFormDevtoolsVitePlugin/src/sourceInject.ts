import type { SourceInjectionOptions } from './types'
import { createHash } from 'node:crypto'
import { parse } from '@babel/parser'
import { parse as parseSfc } from '@vue/compiler-sfc'
import MagicString from 'magic-string'
import { ConfigFormDevtoolsPluginError } from './types'

const DEFAULT_PACKAGE_NAMES = ['@moluoxixi/config-form']
const SUPPORTED_EXTENSIONS = /\.(?:[cm]?[jt]sx?|vue)$/

interface ScriptSegment {
  content: string
  offset: number
  line: number
  column: number
}

interface InjectionEdit {
  end?: number
  index: number
  text: string
}

interface AstNode {
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

interface ImportDeclarationNode extends AstNode {
  source: AstNode & { value?: unknown }
  specifiers: AstNode[]
}

interface ImportSpecifierNode extends AstNode {
  imported?: AstNode & { name?: string }
  local?: AstNode & { name?: string }
}

interface CallExpressionNode extends AstNode {
  callee?: AstNode & { name?: string }
  arguments?: AstNode[]
}

interface ObjectExpressionNode extends AstNode {
  properties?: AstNode[]
}

interface ObjectPropertyNode extends AstNode {
  key?: AstNode
  value?: AstNode
}

interface ArrayExpressionNode extends AstNode {
  elements?: Array<AstNode | null>
}

interface InlineFunctionExpressionNode extends AstNode {
  type: 'ArrowFunctionExpression' | 'FunctionExpression'
}

/** 清理 Vite 模块 id 的 query，并统一路径分隔符。 */
function cleanId(id: string): string {
  return id.split('?')[0].replace(/\\/g, '/')
}

/** 生成写入 __source.file 的稳定文件路径。 */
function normalizeFilePath(id: string): string {
  return cleanId(id)
}

/**
 * 基于源码位置创建短 source id。
 *
 * id 只用于 devtools DOM 关联，不作为安全凭证或跨版本稳定标识。
 */
function createSourceId(file: string, line: number, column: number): string {
  return createHash('sha1')
    .update(`${file}:${line}:${column}`)
    .digest('hex')
    .slice(0, 12)
}

/**
 * 解析 JS/TS/JSX/TSX 脚本内容。
 *
 * 解析失败会转换为插件错误并中断 Vite transform，避免源码位置注入静默失效。
 */
function parseScript(content: string, id: string): AstNode {
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
function isImportedDefineField(node: AstNode): node is ImportSpecifierNode {
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
function collectDefineFieldLocals(ast: AstNode, packageNames: string[]): Set<string> {
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

/**
 * 收集 ConfigForm import source 的重写编辑。
 *
 * 仅在 adapterModuleId 存在时执行，用于把业务导入改到 devtools adapter 虚拟模块。
 */
function collectImportSourceEdits(
  segment: ScriptSegment,
  id: string,
  packageNames: string[],
  adapterModuleId: string | undefined,
): InjectionEdit[] {
  if (!adapterModuleId)
    return []

  const ast = parseScript(segment.content, id)
  const edits: InjectionEdit[] = []
  const body = (ast as { program?: { body?: AstNode[] } }).program?.body ?? []

  for (const node of body) {
    if (node.type !== 'ImportDeclaration')
      continue

    const declaration = node as ImportDeclarationNode
    if (typeof declaration.source.value !== 'string')
      continue
    if (!packageNames.includes(declaration.source.value))
      continue
    if (declaration.source.start == null || declaration.source.end == null) {
      throw new ConfigFormDevtoolsPluginError(
        `[config-form-devtools] Missing import source location in ${id}`,
      )
    }

    edits.push({
      end: segment.offset + declaration.source.end,
      index: segment.offset + declaration.source.start,
      text: JSON.stringify(adapterModuleId),
    })
  }

  return edits
}

/** 读取对象属性 key 的静态名称，仅支持 identifier 和字符串字面量。 */
function getObjectKeyName(node: AstNode): string | undefined {
  if (node.type === 'Identifier' && typeof (node as { name?: unknown }).name === 'string')
    return (node as unknown as { name: string }).name
  if (node.type === 'StringLiteral' && typeof (node as { value?: unknown }).value === 'string')
    return (node as unknown as { value: string }).value
  return undefined
}

/** 判断 defineField 对象是否已经显式包含 __source 配置。 */
function hasSourceProperty(node: ObjectExpressionNode): boolean {
  return (node.properties ?? []).some((property) => {
    if (property.type !== 'ObjectProperty' && property.type !== 'ObjectMethod')
      return false
    const key = (property as { key?: AstNode }).key
    return key ? getObjectKeyName(key) === '__source' : false
  })
}

/** render 函数只接受标准函数表达式或箭头函数，避免改写运行期动态引用。 */
function isInlineFunctionExpression(node: AstNode | undefined): node is InlineFunctionExpressionNode {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression'
}

/** 判断对象属性节点并保留 key/value 类型信息。 */
function isObjectProperty(node: AstNode): node is ObjectPropertyNode {
  return node.type === 'ObjectProperty'
}

/**
 * 深度遍历 Babel AST。
 *
 * 跳过位置和注释元数据，避免递归进入非节点对象造成无意义扫描。
 */
function walkAst(node: AstNode, visitor: (node: AstNode) => void) {
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

/**
 * 将脚本分段内的位置转换为原始文件位置。
 *
 * Vue SFC 的 script/script setup 会带有 offset，首行列号需要额外叠加分段 column。
 */
function toAbsolutePosition(segment: ScriptSegment, loc: NonNullable<AstNode['loc']>['start']) {
  const line = segment.line + loc.line - 1
  const column = loc.line === 1
    ? segment.column + loc.column + 1
    : loc.column + 1
  return { column, line }
}

/** 创建要插入到 defineField 对象中的 __source 字面量文本。 */
function createSourceText(file: string, line: number, column: number): string {
  const id = createSourceId(file, line, column)
  return `__source: { id: ${JSON.stringify(id)}, file: ${JSON.stringify(file)}, line: ${line}, column: ${column} }`
}

/** 将 inline render 函数包装为带源码元数据的函数对象。 */
function createRenderFunctionSourceEdit(segment: ScriptSegment, id: string, node: AstNode): InjectionEdit {
  if (node.start == null || node.end == null || node.loc == null) {
    throw new ConfigFormDevtoolsPluginError(
      `[config-form-devtools] Missing source location for render function in ${id}`,
    )
  }

  const file = normalizeFilePath(id)
  const { column, line } = toAbsolutePosition(segment, node.loc.start)
  const sourceText = createSourceText(file, line, column)
  return {
    end: segment.offset + node.end,
    index: segment.offset + node.start,
    text: `Object.assign(${segment.content.slice(node.start, node.end)}, { ${sourceText} })`,
  }
}

/**
 * 计算 __source 插入前缀。
 *
 * 根据对象末尾前一个非空字符决定是否补逗号，避免破坏现有对象字面量语法。
 */
function getInjectionPrefix(content: string, insertionIndex: number): string {
  const previous = content.slice(0, insertionIndex).match(/\S(?=\s*$)/)?.[0]
  if (previous === '{' || previous === ',')
    return ' '
  return ', '
}

/** 收集 defineField 对象内部 component/slots inline render 函数的源码注入编辑。 */
function collectRenderFunctionEdits(segment: ScriptSegment, id: string, config: ObjectExpressionNode): InjectionEdit[] {
  const edits: InjectionEdit[] = []

  function addRenderEdit(node: AstNode) {
    edits.push(createRenderFunctionSourceEdit(segment, id, node))
  }

  function visitSlotValue(value: AstNode | undefined) {
    if (!value)
      return

    if (isInlineFunctionExpression(value)) {
      addRenderEdit(value)
      return
    }

    if (value.type === 'ArrayExpression') {
      for (const item of (value as ArrayExpressionNode).elements ?? [])
        visitSlotValue(item ?? undefined)
      return
    }

    if (value.type === 'ObjectExpression')
      visitConfigObject(value as ObjectExpressionNode)
  }

  function visitSlotsObject(slots: ObjectExpressionNode) {
    for (const property of slots.properties ?? []) {
      if (!isObjectProperty(property))
        continue
      visitSlotValue(property.value)
    }
  }

  function visitConfigObject(object: ObjectExpressionNode) {
    for (const property of object.properties ?? []) {
      if (!isObjectProperty(property))
        continue

      const keyName = property.key ? getObjectKeyName(property.key) : undefined
      if (keyName === 'component' && isInlineFunctionExpression(property.value)) {
        addRenderEdit(property.value)
        continue
      }

      if (keyName === 'slots' && property.value?.type === 'ObjectExpression') {
        visitSlotsObject(property.value as ObjectExpressionNode)
        continue
      }

      if (property.value?.type === 'ObjectExpression')
        visitConfigObject(property.value as ObjectExpressionNode)
      if (property.value?.type === 'ArrayExpression') {
        for (const item of (property.value as ArrayExpressionNode).elements ?? []) {
          if (item?.type === 'ObjectExpression')
            visitConfigObject(item as ObjectExpressionNode)
        }
      }
    }
  }

  visitConfigObject(config)
  return edits
}

/**
 * 收集 defineField(...) 对象的 __source 注入编辑。
 *
 * 只处理第一个参数为对象字面量的调用；缺失位置信息或已有 __source 会显式抛错。
 */
function collectInjectionEdits(segment: ScriptSegment, id: string, packageNames: string[]): InjectionEdit[] {
  const ast = parseScript(segment.content, id)
  const defineFieldLocals = collectDefineFieldLocals(ast, packageNames)
  const edits: InjectionEdit[] = []

  if (defineFieldLocals.size === 0)
    return edits

  // 只改写从指定 ConfigForm 包导入的 defineField(...)，避免误伤同名业务函数。
  walkAst(ast, (node) => {
    if (node.type !== 'CallExpression')
      return

    const call = node as CallExpressionNode
    if (call.callee?.type !== 'Identifier' || !defineFieldLocals.has(call.callee.name ?? ''))
      return

    const config = call.arguments?.[0]
    if (!config || config.type !== 'ObjectExpression')
      return
    if (config.end == null || config.loc == null)
      throw new ConfigFormDevtoolsPluginError(`[config-form-devtools] Missing source location for defineField in ${id}`)

    const objectConfig = config as ObjectExpressionNode
    if (hasSourceProperty(objectConfig))
      throw new ConfigFormDevtoolsPluginError(`[config-form-devtools] defineField in ${id} already contains __source`)

    const file = normalizeFilePath(id)
    const { column, line } = toAbsolutePosition(segment, config.loc.start)
    const insertionIndex = config.end - 1
    const prefix = getInjectionPrefix(segment.content, insertionIndex)
    edits.push({
      index: segment.offset + insertionIndex,
      text: `${prefix}${createSourceText(file, line, column)}`,
    })
    edits.push(...collectRenderFunctionEdits(segment, id, objectConfig))
  })

  return edits
}

/**
 * 将普通模块或 Vue SFC 拆成可转换脚本分段。
 *
 * 普通模块只有一个分段；Vue 文件只处理 script 和 script setup，模板不注入。
 */
function createScriptSegments(code: string, id: string): ScriptSegment[] {
  if (!cleanId(id).endsWith('.vue')) {
    return [{
      column: 0,
      content: code,
      line: 1,
      offset: 0,
    }]
  }

  const parsed = parseSfc(code, { filename: id })
  if (parsed.errors.length > 0) {
    const message = parsed.errors
      .map(error => error instanceof Error ? error.message : String(error))
      .join('; ')
    throw new ConfigFormDevtoolsPluginError(`[config-form-devtools] Failed to parse Vue SFC ${id}: ${message}`)
  }

  return [parsed.descriptor.script, parsed.descriptor.scriptSetup]
    .filter(segment => Boolean(segment))
    .map(segment => ({
      column: segment!.loc.start.column,
      content: segment!.content,
      line: segment!.loc.start.line,
      offset: segment!.loc.start.offset,
    }))
}

/**
 * 向 defineField(...) 对象字面量注入源码位置元信息。
 *
 * Vue SFC 会按 script block 分段转换，确保行列号仍指向原始文件，而不是抽离后的脚本内容。
 */
export function transformDefineFieldSource(options: SourceInjectionOptions) {
  if (options.id.includes('?'))
    return null

  const id = cleanId(options.id)
  if (!SUPPORTED_EXTENSIONS.test(id))
    return null

  const packageNames = options.packageNames ?? DEFAULT_PACKAGE_NAMES
  const segments = createScriptSegments(options.code, id)
  const edits = segments.flatMap(segment => [
    ...collectImportSourceEdits(segment, id, packageNames, options.adapterModuleId),
    ...collectInjectionEdits(segment, id, packageNames),
  ])

  if (edits.length === 0)
    return null

  const source = new MagicString(options.code)
  for (const edit of edits) {
    if (edit.end == null)
      source.appendLeft(edit.index, edit.text)
    else
      source.overwrite(edit.index, edit.end, edit.text)
  }

  return {
    code: source.toString(),
    map: source.generateMap({
      hires: true,
      source: id,
    }),
  }
}
