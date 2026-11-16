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

/** 解析 interface 的成员为字段定义。索引签名（如 `[name: string]: SlotFn`）也纳入，name 形如 `[name: string]`。 */
function fieldsOfInterface(node: ts.InterfaceDeclaration, full: string): TypeFieldDef[] {
  const fields: TypeFieldDef[] = []
  for (const member of node.members) {
    // 索引签名：动态键成员，组件中常用于「按列名动态声明的插槽」契约
    if (ts.isIndexSignatureDeclaration(member)) {
      const param = member.parameters[0]
      const keyName = param?.name.getText() ?? 'key'
      const keyType = param?.type?.getText() ?? 'string'
      fields.push({
        name: `[${keyName}: ${keyType}]`,
        type: member.type?.getText() ?? 'unknown',
        optional: false,
        description: jsDocOf(member, full),
      })
      continue
    }
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

/** 解析对象字面量 type alias 的成员为字段定义（如 `type X = { a: string }`）。索引签名同 fieldsOfInterface 一并纳入。 */
function fieldsOfTypeLiteral(node: ts.TypeLiteralNode, full: string): TypeFieldDef[] {
  const fields: TypeFieldDef[] = []
  for (const member of node.members) {
    // 索引签名：动态键成员，组件中常用于「按列名动态声明的插槽」契约
    if (ts.isIndexSignatureDeclaration(member)) {
      const param = member.parameters[0]
      const keyName = param?.name.getText() ?? 'key'
      const keyType = param?.type?.getText() ?? 'string'
      fields.push({
        name: `[${keyName}: ${keyType}]`,
        type: member.type?.getText() ?? 'unknown',
        optional: false,
        description: jsDocOf(member, full),
      })
      continue
    }
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
 * 从源码文本中解析所有 interface / type alias 定义。
 * @param full 源码文本（可为 .ts 文件全文或 SFC 的 <script> 块内容）。
 * @param filePath 仅用于 createSourceFile 的文件名标识（诊断用）。
 */
export function parseTypeDefsFromSource(full: string, filePath: string): TypeDefInfo[] {
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

/**
 * 解析单个 `.ts` 源文件，返回其中定义的所有 interface / type alias。
 * @param filePath 类型源文件绝对路径。
 */
export function parseTypeDefs(filePath: string): TypeDefInfo[] {
  return parseTypeDefsFromSource(readFileSync(filePath, 'utf8'), filePath)
}

/**
 * 从 Vue SFC 中抽取所有 `<script>` 块内联定义的 interface / type alias。
 *
 * 关键场景：组件常用 `type RuntimeProps = Omit<XxxProps, 'k'>` 这类「SFC 内联别名」
 * 作为 `defineProps<RuntimeProps>()` 的泛型实参。这些别名不在任何 `.ts` 文件里，
 * 仅靠扫描类型目录无法发现，导致 backfill 找不到 props 类型而全部回退 unknown。
 * 这里把 SFC 脚本块也纳入类型定义来源，与 `.ts` 定义合并后供解析。
 *
 * 读取失败（文件不存在）按缺省返回空数组，由调用方按缺省处理。
 * @param sfcPath SFC 文件绝对路径。
 */
export function extractSfcScriptTypeDefs(sfcPath: string): TypeDefInfo[] {
  let src: string
  try {
    src = readFileSync(sfcPath, 'utf8')
  }
  catch {
    return []
  }
  const defs: TypeDefInfo[] = []
  for (const m of Array.from(src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)))
    defs.push(...parseTypeDefsFromSource(m[1], sfcPath))
  return defs
}

/** 从工具类型的键参数节点（字符串字面量或其联合）抽取键名集合。 */
function literalKeyNames(node: ts.TypeNode): Set<string> {
  const keys = new Set<string>()
  const collect = (n: ts.TypeNode): void => {
    if (ts.isLiteralTypeNode(n) && ts.isStringLiteral(n.literal))
      keys.add(n.literal.text)
    else if (ts.isUnionTypeNode(n))
      n.types.forEach(collect)
  }
  collect(node)
  return keys
}

/**
 * 把一个类型节点解析为扁平字段集合。
 * 支持：本地引用、对象字面量、交叉类型，以及 Omit/Pick/Partial/Required/Readonly 工具类型。
 * 外部类型（无本地定义）或无法解析的结构返回空数组（按缺省，不抛错）。
 */
function resolveTypeNodeFields(
  node: ts.TypeNode,
  byName: Map<string, TypeDefInfo>,
  seen: Set<string>,
): TypeFieldDef[] {
  if (ts.isTypeLiteralNode(node))
    return fieldsOfTypeLiteral(node, node.getText())

  if (ts.isIntersectionTypeNode(node)) {
    const merged = new Map<string, TypeFieldDef>()
    for (const t of node.types) {
      // 每个交叉分支用 seen 的独立副本：防环只需保护单条解析链，
      // 不能让兄弟分支共享 seen，否则 `Pick<Base,'a'> & Pick<Base,'b'>`
      // 第二个分支会因 Base 已在 seen 中而拿到空字段，静默漏收。
      for (const f of resolveTypeNodeFields(t, byName, new Set(seen))) {
        if (!merged.has(f.name))
          merged.set(f.name, f)
      }
    }
    return Array.from(merged.values())
  }

  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText()
    const args = node.typeArguments ?? []
    if ((name === 'Omit' || name === 'Pick') && args.length >= 2) {
      const base = resolveTypeNodeFields(args[0], byName, new Set(seen))
      const keys = literalKeyNames(args[1])
      return name === 'Omit'
        ? base.filter(f => !keys.has(f.name))
        : base.filter(f => keys.has(f.name))
    }
    if ((name === 'Partial' || name === 'Required' || name === 'Readonly') && args.length >= 1) {
      const base = resolveTypeNodeFields(args[0], byName, new Set(seen))
      if (name === 'Partial')
        return base.map(f => ({ ...f, optional: true }))
      if (name === 'Required')
        return base.map(f => ({ ...f, optional: false }))
      return base
    }
    // 普通本地类型引用：按名继续解析
    return resolveNamedTypeFields(name, byName, seen)
  }

  return []
}

/**
 * 把类型名解析为扁平字段集合，跟随别名与工具类型（Omit/Pick/Partial 等）直至 interface 字段。
 *
 * 解决「defineProps 的泛型是 `Omit<XxxProps,'k'>` 这类间接别名」时，
 * 直接按名查 interface 拿不到字段的问题：先找到别名定义，再解析其原文目标类型。
 * @param name 起始类型名。
 * @param byName 全部类型定义（含 SFC 内联别名）按名索引。
 * @param seen 防环集合。
 */
export function resolveNamedTypeFields(
  name: string,
  byName: Map<string, TypeDefInfo>,
  seen: Set<string> = new Set(),
): TypeFieldDef[] {
  if (seen.has(name))
    return []
  seen.add(name)
  const def = byName.get(name)
  if (!def)
    return []
  // interface 或对象字面量 alias：已有直接字段，直接返回
  if (def.fields.length)
    return def.fields
  // 无直接字段的 alias（Omit/Pick/交叉/引用）：解析其原文目标类型节点
  const sf = ts.createSourceFile('__alias.ts', def.raw, ts.ScriptTarget.Latest, true)
  let result: TypeFieldDef[] = []
  sf.forEachChild((node) => {
    if (ts.isTypeAliasDeclaration(node))
      result = resolveTypeNodeFields(node.type, byName, seen)
  })
  return result
}
