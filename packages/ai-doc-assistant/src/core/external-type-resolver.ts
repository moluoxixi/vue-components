import type { TypeDefInfo } from './types'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve as resolvePath } from 'node:path'
import process from 'node:process'
import { parseTypeDefs } from './type-resolver'

const require = createRequire(import.meta.url)

/**
 * 外部 / 跨目录类型展开器（#2 类型展开补强）。
 *
 * collectTypeDefs 只扫描组件自身 `src/` 目录下的 `.ts`，因此两类被 props 引用的类型拿不到字段：
 * 1. 同包但在组件目录外的类型——如 `ThrottleOrDebounceOptions = ScheduleOptions & {...}`，
 *    其中 `ScheduleOptions` 定义在 `packages/components/src/utils/schedule.ts`，经 `../../../utils`
 *    桶文件再导出。组件目录扫描不到 → 交叉类型展开拿到空字段。
 * 2. 外部库类型——如 element-plus 的 `PopoverProps` / `InputProps`，定义在 node_modules 的 `.d.ts` 里。
 *
 * 本模块从组件类型源文件的 `import` 语句出发，按名跟随到来源模块（相对路径 .ts / 外部库 .d.ts），
 * 用纯语法解析（ts.createSourceFile，复用 parseTypeDefsFromSource）抽取目标 interface/type 的字段，
 * 深度 1 层：只展开 props 直接引用的这一层，第三方再嵌套（如 element-plus 内部 EpProp* / @popperjs）
 * 不继续下钻，保留其类型字符串。
 *
 * 不静默吞错也不伪造：来源文件读不到 / 解析不出目标类型时，返回带空 fields 的占位定义并在 raw 里
 * 标注来源路径与未能展开的原因，供 UI 显示「展不开 + 原因」，绝不假装有字段。
 */

/** import 语句解析结果：裸类型名 → 来源模块说明符（相对路径或包名）。 */
interface ImportBinding {
  /** 导入的类型名（可能经 `as` 重命名，取本地可见名）。 */
  localName: string
  /** 原始导出名（`import { A as B }` 时为 A；无重命名时同 localName）。 */
  importedName: string
  /** 模块说明符，如 `../../../utils`、`element-plus`、`vue`。 */
  moduleSpecifier: string
}

/** 从一段源码里解析所有 `import { ... } from '...'`（含 `import type`）的命名绑定。 */
function parseImportBindings(source: string): ImportBinding[] {
  const bindings: ImportBinding[] = []
  // 匹配命名导入：import [type] { a, b as c } from 'mod'
  const re = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g
  for (const m of Array.from(source.matchAll(re))) {
    const moduleSpecifier = m[2]
    for (const raw of m[1].split(',')) {
      const part = raw.trim().replace(/^type\s+/, '')
      if (!part)
        continue
      const asMatch = part.match(/^(\w+)\s+as\s+(\w+)$/)
      if (asMatch)
        bindings.push({ importedName: asMatch[1], localName: asMatch[2], moduleSpecifier })
      else
        bindings.push({ importedName: part, localName: part, moduleSpecifier })
    }
  }
  return bindings
}

/** 把模块说明符解析为磁盘上的 .ts 文件路径（相对导入）。尝试 .ts / index.ts。 */
function resolveRelativeTsFile(fromFile: string, specifier: string): string | null {
  const base = resolvePath(dirname(fromFile), specifier)
  const candidates = [
    `${base}.ts`,
    `${base}.d.ts`,
    resolvePath(base, 'index.ts'),
    resolvePath(base, 'index.d.ts'),
  ]
  for (const c of candidates) {
    if (existsSync(c))
      return c
  }
  return null
}

/**
 * 在一个 .ts 桶文件（barrel）里跟随 `export { X } from './sub'` / `export type { X } from './sub'`，
 * 把目标名定位到真正定义它的子文件。命中则返回该子文件里解析出的目标定义；否则 null。
 * 仅跟随一层 re-export（utils/index.ts → schedule.ts 这种），不做无限递归。
 */
function followBarrelReexport(barrelFile: string, targetName: string): TypeDefInfo | null {
  let src: string
  try {
    src = readFileSync(barrelFile, 'utf8')
  }
  catch {
    return null
  }
  const re = /export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g
  for (const m of Array.from(src.matchAll(re))) {
    const names = m[1].split(',').map(s => s.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim())
    if (!names.includes(targetName))
      continue
    const subFile = resolveRelativeTsFile(barrelFile, m[2])
    if (!subFile)
      continue
    const def = parseTypeDefs(subFile).find(d => d.name === targetName)
    if (def)
      return def
  }
  return null
}

/** element-plus 包根（types 入口 es/index.d.ts）解析；解析不到返回 null。 */
function resolveElementPlusEntry(fromFile: string): string | null {
  try {
    const pkgJson = require.resolve('element-plus/package.json', { paths: [dirname(fromFile), process.cwd()] })
    const types = (JSON.parse(readFileSync(pkgJson, 'utf8')).types as string) || 'es/index.d.ts'
    const entry = resolvePath(dirname(pkgJson), types)
    return existsSync(entry) ? entry : null
  }
  catch {
    return null
  }
}

/**
 * 在 element-plus 入口 d.ts 里按名找到 `import { Name } from "./components/.../x.js"`，
 * 把 `.js` 还原为 `.d.ts`，纯语法解析该文件中的目标 interface（深度 1）。
 * 任何环节失败返回 null（由调用方生成占位 + 原因）。
 */
function resolveFromElementPlus(entryFile: string, targetName: string): TypeDefInfo | null {
  let entrySrc: string
  try {
    entrySrc = readFileSync(entryFile, 'utf8')
  }
  catch {
    return null
  }
  const re = /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g
  for (const m of Array.from(entrySrc.matchAll(re))) {
    const names = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim())
    if (!names.includes(targetName))
      continue
    const dtsRel = m[2].replace(/\.js$/, '.d.ts')
    const dtsFile = resolvePath(dirname(entryFile), dtsRel)
    if (!existsSync(dtsFile))
      continue
    const def = parseTypeDefs(dtsFile).find(d => d.name === targetName)
    if (def)
      return def
  }
  return null
}

/** 生成「展不开」占位：fields 空，raw 标注来源与原因，UI 据此显示原因而非假字段。 */
function unresolvedDef(name: string, source: string, reason: string): TypeDefInfo {
  return { name, kind: 'type', fields: [], raw: `/* 未能展开：来源=${source}，原因=${reason} */` }
}

/**
 * 解析组件 props 引用、但 collectTypeDefs 未覆盖的外部 / 跨目录类型。
 *
 * @param typeSourceFiles 组件类型源文件绝对路径列表（通常是 `src/types/*.ts`），用于读取其 import 映射。
 * @param neededNames     需要展开的裸类型名集合（props 引用但本地 typeDefs 里缺失字段的）。
 * @returns 每个 needed 名对应一个 TypeDefInfo：成功带字段，失败为占位（fields 空 + 原因），不抛错、不静默丢弃。
 */
export function resolveExternalTypeDefs(typeSourceFiles: string[], neededNames: string[]): TypeDefInfo[] {
  const out: TypeDefInfo[] = []
  const seen = new Set<string>()

  // 汇总所有类型源文件的 import 绑定：localName → binding（后出现的覆盖，组件内通常唯一）。
  const bindingByName = new Map<string, { binding: ImportBinding, fromFile: string }>()
  for (const file of typeSourceFiles) {
    let src: string
    try {
      src = readFileSync(file, 'utf8')
    }
    catch {
      continue
    }
    for (const b of parseImportBindings(src))
      bindingByName.set(b.localName, { binding: b, fromFile: file })
  }

  for (const name of neededNames) {
    if (seen.has(name))
      continue
    seen.add(name)

    const entry = bindingByName.get(name)
    if (!entry) {
      // props 引用了一个既非本地定义、又不在任何类型源文件 import 里的名字——无从定位。
      out.push(unresolvedDef(name, '未知', '未在组件类型文件的 import 中找到来源'))
      continue
    }

    const { binding, fromFile } = entry
    const spec = binding.moduleSpecifier

    if (spec.startsWith('.')) {
      // 同包相对路径：解析到 .ts，先直接找定义，找不到则跟随桶文件 re-export。
      const tsFile = resolveRelativeTsFile(fromFile, spec)
      if (!tsFile) {
        out.push(unresolvedDef(name, spec, '相对路径无法解析到 .ts 文件'))
        continue
      }
      const direct = parseTypeDefs(tsFile).find(d => d.name === binding.importedName)
      const def = direct ?? followBarrelReexport(tsFile, binding.importedName)
      out.push(def ? { ...def, name } : unresolvedDef(name, tsFile, '源文件中未找到该类型定义'))
    }
    else if (spec === 'element-plus') {
      const entryFile = resolveElementPlusEntry(fromFile)
      if (!entryFile) {
        out.push(unresolvedDef(name, spec, '无法解析 element-plus 类型入口'))
        continue
      }
      const def = resolveFromElementPlus(entryFile, binding.importedName)
      out.push(def ? { ...def, name } : unresolvedDef(name, spec, 'element-plus 入口未映射到该类型或解析失败'))
    }
    else {
      // 其它外部库（vue 等）：本期只展开 element-plus，其余保留类型字符串，标注原因。
      out.push(unresolvedDef(name, spec, `本期未展开第三方库 ${spec} 的类型`))
    }
  }

  return out
}
