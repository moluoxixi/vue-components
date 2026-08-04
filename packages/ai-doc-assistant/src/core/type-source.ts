import type { TypeDefInfo, TypeFieldDef } from './types'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import ts from 'typescript'

/**
 * 组件本地类型源的轻量语法解析（后处理专用）。
 *
 * vue-component-meta 已接管 props/emits/slots/exposed 的类型解析与展开，本模块只保留
 * meta 能力盲区的后处理所需的语法原语：
 * - 动态插槽：从 `<Comp>Slots` 契约接口（含索引签名）派生 meta 丢弃的动态插槽说明。
 * - defineAttrs：meta 完全不体现 `defineAttrs<T>()`，需从 SFC 抽泛型名再解析 T 字段。
 *
 * 纯 TypeScript 语法遍历，不启动 type checker，确定性强。类型语义解析仍由 checker 承担；
 * 此处只跟随本地相对 import 定位契约实际引用的 raw 声明，不模拟 Omit/Pick 或解析第三方类型。
 */

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

/** 解析 interface 成员为字段定义。索引签名（如 `[name: string]: SlotFn`）也纳入，name 形如 `[name: string]`。 */
function fieldsOfInterface(node: ts.InterfaceDeclaration, full: string): TypeFieldDef[] {
  return membersToFields(node.members, full)
}

/** 解析对象字面量 type alias 成员为字段定义。 */
function fieldsOfTypeLiteral(node: ts.TypeLiteralNode, full: string): TypeFieldDef[] {
  return membersToFields(node.members, full)
}

/** interface / type literal 成员 → 字段定义（含索引签名）。 */
function membersToFields(members: ts.NodeArray<ts.TypeElement>, full: string): TypeFieldDef[] {
  const fields: TypeFieldDef[] = []
  for (const member of members) {
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
 * 从源码文本解析所有 interface / type alias 定义。
 * @param full 源码文本（.ts 全文或 SFC `<script>` 块内容）。
 * @param filePath createSourceFile 的文件名标识（诊断用）。
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

/** 解析单个 `.ts` 源文件，返回其中定义的所有 interface / type alias。 */
export function parseTypeDefs(filePath: string): TypeDefInfo[] {
  return parseTypeDefsFromSource(readFileSync(filePath, 'utf8'), filePath)
}

/**
 * 从 Vue SFC 的所有 `<script>` 块抽取内联 interface / type alias 定义。
 * 读取失败按缺省返回空数组。
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

/**
 * Read the public member names declared by `defineExpose`.
 *
 * vue-component-meta may include props, listeners, and `$slots` in `meta.exposed`.
 * Those are component-instance members, but they are not declarations made through
 * `defineExpose`. Returning `null` means the macro exists but uses a dynamic shape
 * that cannot be resolved safely, so callers can retain the checker output.
 */
export function extractDefineExposeNames(sfcPath: string): string[] | null {
  let src: string
  try {
    src = readFileSync(sfcPath, 'utf8')
  }
  catch {
    return null
  }

  const names = new Set<string>()
  let found = false
  let unresolved = false

  function addPropertyName(name: ts.PropertyName | undefined): void {
    if (!name) {
      unresolved = true
      return
    }
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
      names.add(name.text)
      return
    }
    if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) {
      names.add(name.expression.text)
      return
    }
    unresolved = true
  }

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'defineExpose') {
      found = true
      const argument = node.arguments[0]
      if (argument && ts.isObjectLiteralExpression(argument)) {
        for (const property of argument.properties) {
          if (ts.isSpreadAssignment(property)) {
            unresolved = true
            continue
          }
          addPropertyName(property.name)
        }
      }
      else {
        const typeArgument = node.typeArguments?.[0]
        if (typeArgument && ts.isTypeLiteralNode(typeArgument)) {
          for (const member of typeArgument.members)
            addPropertyName(member.name)
        }
        else {
          unresolved = true
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  for (const [index, match] of Array.from(src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)).entries()) {
    const sourceFile = ts.createSourceFile(`${sfcPath}.${index}.ts`, match[1], ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    visit(sourceFile)
  }

  if (!found)
    return []
  return unresolved ? null : Array.from(names)
}

/**
 * 从 SFC 路径向上查找名为 `src` 的祖先目录，作为类型源扫描根。
 * 组件约定结构为 `<pkg>/src/<Comp>/src/...` 或 `<Comp>/src/...`。找不到返回 null。
 */
function findSrcRoot(sfcPath: string): string | null {
  let dir = dirname(sfcPath)
  for (let prev = ''; dir && dir !== prev; prev = dir, dir = dirname(dir)) {
    if (basename(dir) === 'src')
      return dir
  }
  return null
}

/** Resolve a relative module specifier to a TypeScript source file. */
function resolveRelativeTypeSource(importerPath: string, specifier: string): string | null {
  if (!specifier.startsWith('.'))
    return null

  const base = resolve(dirname(importerPath), specifier)
  const candidates = extname(base)
    ? [base]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.mts`,
        `${base}.cts`,
        join(base, 'index.ts'),
        join(base, 'index.tsx'),
        join(base, 'index.mts'),
        join(base, 'index.cts'),
      ]

  for (const candidate of candidates) {
    if (candidate.endsWith('.d.ts') || !existsSync(candidate))
      continue
    try {
      if (statSync(candidate).isFile())
        return candidate
    }
    catch {
      // The candidate can disappear between existsSync and statSync.
    }
  }
  return null
}

/**
 * Follow relative imports from an SFC into TypeScript sources, including transitive imports.
 * Imported definitions take precedence over the component-directory fallback scan because they
 * are the exact symbols used by the component contract.
 */
function collectImportedTypeSources(sfcPath: string): string[] {
  const sources: string[] = []
  const visited = new Set<string>([sfcPath])

  const visit = (filePath: string, source: string): void => {
    const scriptSources = filePath.endsWith('.vue')
      ? Array.from(source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g), match => match[1])
      : [source]

    for (const scriptSource of scriptSources) {
      const imports = ts.preProcessFile(scriptSource, true, true).importedFiles
      for (const imported of imports) {
        const resolved = resolveRelativeTypeSource(filePath, imported.fileName)
        if (!resolved || visited.has(resolved))
          continue
        visited.add(resolved)
        sources.push(resolved)
        try {
          visit(resolved, readFileSync(resolved, 'utf8'))
        }
        catch (err) {
          throw new Error(`read imported type source failed for ${resolved}: ${(err as Error).message}`, { cause: err })
        }
      }
    }
  }

  try {
    visit(sfcPath, readFileSync(sfcPath, 'utf8'))
  }
  catch (err) {
    throw new Error(`collect imported type sources failed for ${sfcPath}: ${(err as Error).message}`, { cause: err })
  }
  return sources
}

/**
 * 收集 SFC 内联、相对 import 图和组件目录 `.ts` 中的本地 interface / type 定义。
 * 用于动态插槽契约（`<Comp>Slots`）与 defineAttrs 泛型 T 的字段解析。
 * 实际 import 优先；目录扫描作为未显式 import 契约的兜底。跳过 node_modules / .d.ts / 测试文件。
 */
export function collectLocalTypeDefs(sfcPath: string): TypeDefInfo[] {
  const scanRoot = findSrcRoot(sfcPath) ?? dirname(sfcPath)
  const defs: TypeDefInfo[] = []
  const seen = new Set<string>()

  const addDefs = (sourceDefs: TypeDefInfo[]): void => {
    for (const def of sourceDefs) {
      if (seen.has(def.name))
        continue
      seen.add(def.name)
      defs.push(def)
    }
  }

  // SFC inline and explicitly imported types are the most precise sources.
  addDefs(extractSfcScriptTypeDefs(sfcPath))
  for (const importedPath of collectImportedTypeSources(sfcPath)) {
    try {
      addDefs(parseTypeDefs(importedPath))
    }
    catch (err) {
      throw new Error(`parseTypeDefs failed for ${importedPath}: ${(err as Error).message}`, { cause: err })
    }
  }

  const walk = (dir: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    }
    catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry)
      let isDir = false
      try {
        isDir = statSync(full).isDirectory()
      }
      catch {
        continue
      }
      if (isDir) {
        if (entry !== 'node_modules')
          walk(full)
        continue
      }
      if (!entry.endsWith('.ts') || entry.endsWith('.d.ts') || entry.includes('.test.') || entry.includes('.spec.'))
        continue
      try {
        addDefs(parseTypeDefs(full))
      }
      catch (err) {
        throw new Error(`parseTypeDefs failed for ${full}: ${(err as Error).message}`, { cause: err })
      }
    }
  }

  walk(scanRoot)

  return defs
}

/**
 * 从 SFC 的 `<script setup>` 抽取 `defineAttrs<T>()` 的泛型类型名。
 * meta 完全不体现 defineAttrs，需此处定位 T 再解析其字段。
 * 拿不到（无 defineAttrs、无泛型）返回 null。
 */
export function extractDefineAttrsTypeName(sfcPath: string): string | null {
  let src: string
  try {
    src = readFileSync(sfcPath, 'utf8')
  }
  catch {
    return null
  }
  const m = src.match(/defineAttrs\s*<([^>(]+)>/)
  if (!m)
    return null
  const refs = (m[1].match(/[A-Z]\w*/g) ?? [])
  return refs[0] ?? null
}
