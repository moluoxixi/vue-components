import type { TypeDefInfo, TypeFieldDef } from './types'
/**
 * 自定义类型展开器（方案 A 核心）。
 *
 * vue-docgen-api 只把 prop 类型抽成字符串名（如 `PopoverTableColumn[]`），不展开
 * 自定义 interface 的字段结构，导致「columns 这一列里 field/title/slots 怎么写」
 * 这类问题在知识库中无据可依。本模块用 TypeScript 编译器 API 做纯语法解析
 * （不启动 type checker，零网络/零类型推断开销），从组件目录下的 `.ts` 类型源中
 * 抽取 interface / type alias 的字段定义，补齐契约的结构化字段口径。
 *
 * 设计取舍：
 * - 用 ts.createSourceFile 纯语法树遍历，确定性强、不挑泛型、无需解析 import 图。
 * - 只抽取「项目内本地定义」的类型；element-plus 等外部类型不展开（无源可读，且非本库契约）。
 * - 抽取失败（文件不存在/解析异常）按边界数据处理：跳过该文件并向上抛出带上下文的错误，
 *   由调用方决定降级策略，绝不静默吞掉。
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'

/**
 * 从类型字符串中剥离修饰，提取其引用的裸类型名集合。
 * 处理：数组 `T[]` / `Array<T>`、`Partial<T>` 等包装、联合 `A | B`、`| null`、`readonly`。
 * 例：`PopoverTableColumn[]` → ['PopoverTableColumn']；
 *     `Partial<PopoverProps> | null` → ['PopoverProps']（外部类型，后续按本地定义存在性过滤）。
 */
export function extractTypeRefs(typeStr: string): string[] {
  if (!typeStr || typeStr === 'unknown')
    return []
  // 抓出所有 PascalCase 标识符（自定义类型约定首字母大写），排除 TS 内建工具类型与基础类型
  const builtins = new Set([
    'Array',
    'Partial',
    'Required',
    'Readonly',
    'Record',
    'Pick',
    'Omit',
    'Exclude',
    'Extract',
    'ReturnType',
    'Parameters',
    'Promise',
    'Map',
    'Set',
    'Date',
    'RegExp',
    'Boolean',
    'Number',
    'String',
    'Object',
    'Function',
  ])
  const matches = typeStr.match(/[A-Z]\w*/g) ?? []
  return Array.from(new Set(matches)).filter(name => !builtins.has(name))
}

/** 取节点前缀的 JSDoc 文本（若有），用于字段/类型说明。 */
function jsDocOf(node: ts.Node, full: string): string {
  const ranges = ts.getLeadingCommentRanges(full, node.getFullStart())
  if (!ranges?.length)
    return ''
  return ranges
    .map(r => full.slice(r.pos, r.end))
    .join('\n')
    .replace(/\/\*\*?|\*\/|^\s*\*/gm, '')
    .replace(/^[/\s]+|[/\s]+$/g, '')
    .trim()
}

/** 解析 interface 的成员为字段定义。 */
function fieldsOfInterface(node: ts.InterfaceDeclaration, full: string): TypeFieldDef[] {
  const fields: TypeFieldDef[] = []
  for (const member of node.members) {
    if (!ts.isPropertySignature(member) || !member.name)
      continue
    const name = member.name.getText()
    const type = member.type?.getText() ?? 'unknown'
    fields.push({
      name,
      type,
      optional: !!member.questionToken,
      description: jsDocOf(member, full),
    })
  }
  return fields
}

/** 解析对象字面量 type alias 的成员为字段定义（如 `type X = { a: string }`）。 */
function fieldsOfTypeLiteral(node: ts.TypeLiteralNode, full: string): TypeFieldDef[] {
  const fields: TypeFieldDef[] = []
  for (const member of node.members) {
    if (!ts.isPropertySignature(member) || !member.name)
      continue
    fields.push({
      name: member.name.getText(),
      type: member.type?.getText() ?? 'unknown',
      optional: !!member.questionToken,
      description: jsDocOf(member, full),
    })
  }
  return fields
}

/**
 * 从 Vue SFC 的 `<script setup lang="ts">` 中抽取 `defineProps<XXX>()` 的泛型类型名。
 *
 * vue-docgen-api 能列出 prop 名，但当 props 来自 `defineProps<导入接口>()` 时，
 * 它把每个 prop 的类型报成 `unknown`，丢失了「columns 是 PopoverTableColumn[]」这层关键信息。
 * 这里直接读 SFC 源码，正则定位 `defineProps<...>()`（含 `withDefaults(defineProps<...>(), ...)`），
 * 取出泛型实参里的裸类型名（取首个 PascalCase 标识符），供调用方回查本地接口字段。
 *
 * 仅做语法层面的轻量提取：拿不到（运行时 props 声明、无泛型）时返回 null，由调用方按缺省处理，不抛错。
 * @param sfcPath SFC 文件绝对路径。
 */
export function extractDefinePropsTypeName(sfcPath: string): string | null {
  let src: string
  try {
    src = readFileSync(sfcPath, 'utf8')
  }
  catch {
    return null
  }
  // 匹配 defineProps<XXX>() —— XXX 可能含修饰（交叉/联合/数组），取其中首个 PascalCase 名
  const m = src.match(/defineProps\s*<([^>]+)>/)
  if (!m)
    return null
  const refs = extractTypeRefs(m[1])
  return refs[0] ?? null
}

/**
 * 解析单个 `.ts` 源文件，返回其中定义的所有 interface / type alias。
 * @param filePath 类型源文件绝对路径。
 */
export function parseTypeDefs(filePath: string): TypeDefInfo[] {
  const full = readFileSync(filePath, 'utf8')
  const sf = ts.createSourceFile(filePath, full, ts.ScriptTarget.Latest, true)
  const defs: TypeDefInfo[] = []

  sf.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node)) {
      defs.push({
        name: node.name.text,
        kind: 'interface',
        fields: fieldsOfInterface(node, full),
        raw: node.getText(sf).trim(),
      })
    }
    else if (ts.isTypeAliasDeclaration(node)) {
      const fields = ts.isTypeLiteralNode(node.type)
        ? fieldsOfTypeLiteral(node.type, full)
        : []
      defs.push({
        name: node.name.text,
        kind: 'type',
        fields,
        raw: node.getText(sf).trim(),
      })
    }
  })

  return defs
}
