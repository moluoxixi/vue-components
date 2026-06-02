import type {
  ArrayExpressionNode,
  AstNode,
  CallExpressionNode,
  ImportDeclarationNode,
  ObjectExpressionNode,
} from './ast'
import { createHash } from 'node:crypto'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { ConfigFormDevtoolsPluginError } from '../types'
import {
  collectDefineFieldLocals,
  getObjectKeyName,
  hasSourceProperty,
  isInlineFunctionExpression,
  isObjectProperty,
  parseScript,
  walkAst,
} from './ast'

export interface ScriptSegment {
  content: string
  offset: number
  line: number
  column: number
}

export interface InjectionEdit {
  end?: number
  index: number
  text: string
}

const DEFAULT_PACKAGE_NAMES = ['@moluoxixi/config-form']

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

/** 将脚本分段内的位置转换为原始文件位置。 */
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

/** 收集 defineField(...) 对象内部 component/slots inline render 函数的源码注入编辑。 */
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

/** 收集 defineField(...) 对象的 __source 注入编辑。 */
export function collectInjectionEdits(segment: ScriptSegment, id: string, packageNames: string[]): InjectionEdit[] {
  const ast = parseScript(segment.content, id)
  const defineFieldLocals = collectDefineFieldLocals(ast, packageNames)
  const edits: InjectionEdit[] = []

  if (defineFieldLocals.size === 0)
    return edits

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

/** 仅在配置包 import 命中时，改写源码中的 ConfigForm 导入路径。 */
export function collectImportSourceEdits(
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

/** 将普通模块或 Vue SFC 拆成可转换脚本分段。 */
export function createScriptSegments(code: string, id: string): ScriptSegment[] {
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

/** 默认识别的 ConfigForm 包名。 */
export function getDefaultPackageNames(): string[] {
  return DEFAULT_PACKAGE_NAMES
}
