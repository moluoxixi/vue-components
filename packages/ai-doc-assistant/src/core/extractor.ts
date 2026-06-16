import type { ComponentContract, EmitDef, ModelDef, PropDef, SlotDef, TypeDefInfo } from './types'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parse } from 'vue-docgen-api'
import { resolveExternalTypeDefs } from './external-type-resolver'
import {
  extractDefinePropsTypeName,
  extractSfcScriptTypeDefs,
  extractTypeRefs,
  parseTypeDefs,
  resolveNamedTypeFields,
} from './type-resolver'

/**
 * vue-docgen-api 的 prop 描述子（仅声明本模块实际读取的字段）。
 * 注意：type/required/description 在运行时组件上常缺省，属库的真实输出特性，按边界数据安全取默认。
 */
interface RawProp {
  name: string
  description?: string
  required?: boolean
  type?: { name: string }
  defaultValue?: { func: boolean, value: string }
}
interface RawEvent {
  name: string
  description?: string
  type?: { names: string[] }
}
interface RawSlot {
  name: string
  description?: string
  bindings?: { name: string, type?: { name: string } }[]
}
interface RawDoc {
  displayName?: string
  description?: string
  props?: RawProp[]
  events?: RawEvent[]
  slots?: RawSlot[]
  sourceFiles?: string[]
}

/** PascalCase 公共导出名通常比插件运行时 name 更适合作为文档检索名。 */
function isPascalCase(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name)
}

/** 从 SFC 文件路径推断组件名：displayName 不可靠时优先使用公共入口导出名兜底。 */
function resolveComponentName(filePath: string, displayName?: string, exportName?: string): string {
  if (exportName && (!displayName || displayName === 'src' || displayName === 'index' || !isPascalCase(displayName)))
    return exportName
  if (displayName && displayName !== 'src' && displayName !== 'index')
    return displayName
  if (exportName)
    return exportName
  const dir = basename(dirname(filePath))
  if (dir === 'src')
    return basename(dirname(dirname(filePath)))
  return dir
}

function mapProps(raw: RawProp[]): PropDef[] {
  return raw.map(p => ({
    name: p.name,
    type: p.type?.name ?? 'unknown',
    required: p.required ?? false,
    defaultValue: p.defaultValue?.value ?? null,
    description: p.description ?? '',
    typeRefs: extractTypeRefs(p.type?.name ?? ''),
  }))
}

function mapEmits(raw: RawEvent[]): EmitDef[] {
  return raw.map(e => ({
    name: e.name,
    payloadType: e.type?.names?.join(' | ') ?? 'unknown',
    description: e.description ?? '',
  }))
}

function mapSlots(raw: RawSlot[]): SlotDef[] {
  return raw.map(s => ({
    name: s.name,
    scopeType: (s.bindings ?? []).map(b => `${b.name}: ${b.type?.name ?? 'unknown'}`).join(', '),
    description: s.description ?? '',
  }))
}

/** v-model 约定：emit `update:xxx` 推断出名为 xxx 的 model 绑定。 */
function deriveModels(emits: EmitDef[]): ModelDef[] {
  return emits
    .filter(e => e.name.startsWith('update:'))
    .map(e => ({
      name: e.name.slice('update:'.length),
      type: e.payloadType,
      description: `v-model:${e.name.slice('update:'.length)}`,
    }))
}

/**
 * 收集组件目录下所有 `.ts` 类型源文件的类型定义。
 * SFC 通常位于 `<comp>/src/index.vue`，类型多在 `<comp>/src/types/*.ts` 或 `<comp>/src/*.ts`。
 * 从 SFC 所在目录向上取到组件根（src 的父级），递归扫描其下 `.ts`（排除 .d.ts 与 test）。
 * 解析失败按边界数据处理：抛出带文件上下文的错误，不静默吞掉。
 */
/**
 * 从 SFC 路径向上查找名为 `src` 的祖先目录，作为类型源扫描根。
 * 组件约定结构为 `<pkg>/src/<Comp>/src/...` 或 `<Comp>/src/...`，类型多挂在该 `src` 下的 `types/`。
 * 找不到（路径中无 src 段）时返回 null，由调用方回退到 SFC 同级目录。
 */
function findSrcRoot(sfcPath: string): string | null {
  let dir = dirname(sfcPath)
  // 防御无限循环：到达文件系统根（dirname 不再变化）即停
  for (let prev = ''; dir && dir !== prev; prev = dir, dir = dirname(dir)) {
    if (basename(dir) === 'src')
      return dir
  }
  return null
}

/**
 * 收集组件类型源文件（`.ts`）的绝对路径列表，用于读取其 import 映射（外部 / 跨目录类型展开）。
 * 扫描根与 collectTypeDefs 一致（向上找 `src`），跳过 node_modules / .d.ts / 测试文件。
 */
function collectTypeSourceFiles(sfcPath: string): string[] {
  const scanRoot = findSrcRoot(sfcPath) ?? dirname(sfcPath)
  const files: string[] = []
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
      files.push(full)
    }
  }
  walk(scanRoot)
  return files
}

function collectTypeDefs(sfcPath: string): TypeDefInfo[] {
  // 组件根目录定位：类型源常位于 `<Comp>/src/types/*.ts`，而 SFC 可能在 `<Comp>/src/index.vue`
  // 或更深的 `<Comp>/src/base/index.vue`。从 SFC 向上找到名为 `src` 的目录作为扫描根，
  // 覆盖同级与 types 子目录；找不到 src 时回退到 SFC 所在目录。
  const scanRoot = findSrcRoot(sfcPath) ?? dirname(sfcPath)
  const roots = [scanRoot]
  const defs: TypeDefInfo[] = []
  const seen = new Set<string>()

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
        for (const def of parseTypeDefs(full)) {
          if (seen.has(def.name))
            continue
          seen.add(def.name)
          defs.push(def)
        }
      }
      catch (err) {
        throw new Error(`parseTypeDefs failed for ${full}: ${(err as Error).message}`, { cause: err })
      }
    }
  }

  for (const root of roots)
    walk(root)

  // 合并 SFC `<script>` 内联定义的 interface / type alias（如
  // `type RuntimeProps = Omit<XxxProps, 'k'>`）。这些别名不在任何 .ts 文件中，
  // 是 defineProps 泛型实参的常见来源，必须纳入才能正确回填 prop 类型。
  for (const def of extractSfcScriptTypeDefs(sfcPath)) {
    if (seen.has(def.name))
      continue
    seen.add(def.name)
    defs.push(def)
  }

  return defs
}

/**
 * 从插槽契约接口（约定名 `<Comp>Slots`）派生插槽定义。
 *
 * vue-docgen 对 `<template v-for="name in slotNames" #[name]>` 这类「按列动态插槽转发」写法，
 * 会把字面量 `name` 误当成一个名为 "name" 的具名插槽，产出伪插槽。组件真实的插槽契约写在
 * `src/types/slots.ts` 的 `<Comp>Slots` interface 里（含具名插槽与 `[k: string]` 索引签名表达的动态插槽）。
 * 这里优先用契约接口派生插槽：具名键 → 具名插槽；索引签名 → 一个 `[dynamic]` 动态插槽说明。
 * 找不到契约接口时返回 null，由调用方回退到 vue-docgen 结果（不静默丢插槽）。
 * @param componentName 组件名，用于拼出契约接口名 `<Comp>Slots`。
 * @param allDefs 已收集的全部本地类型定义（含 SFC 内联）。
 */
function deriveSlotsFromContract(componentName: string, allDefs: TypeDefInfo[]): SlotDef[] | null {
  const ifaceName = `${componentName}Slots`
  const def = allDefs.find(d => d.name === ifaceName)
  if (!def)
    return null
  const slots: SlotDef[] = []
  let hasIndexSignature = false
  for (const f of def.fields) {
    // 索引签名字段在解析时其 name 形如 `[name: string]` / `[key: string]`，用方括号识别
    if (f.name.startsWith('[')) {
      hasIndexSignature = true
      continue
    }
    slots.push({ name: f.name, scopeType: f.type, description: f.description })
  }
  if (hasIndexSignature) {
    slots.push({
      name: '[dynamic]',
      scopeType: 'Record<string, any>',
      description: '按列名动态声明的单元格插槽（插槽名取自各列 field），作用域参数为该列的行/列/值上下文。',
    })
  }
  return slots
}

/**
 * 把「被父组件通过 v-bind="$attrs" 透传的内部子组件」契约合并进父组件。
 *
 * 组件库常见结构：外层 `<Comp>/src/index.vue` 仅做交互编排，把表格/弹层等核心 props
 * （如 `columns: PopoverTableColumn[]`）声明在内部 `<Comp>/src/<sub>/index.vue` 上，
 * 再用 `v-bind="$attrs"` 整体转发。对使用者而言，这些子组件 props 就是外层组件对外 API 的一部分，
 * 必须并入父契约，否则会丢失 columns 等关键可配置项。
 *
 * 仅在父 SFC 模板中确实出现 `v-bind="$attrs"` 时才合并（确认存在透传语义），
 * 并对子组件 props 做去重（父已显式声明的同名 prop 优先保留）。
 * @param parentSfcPath 父组件 SFC 绝对路径。
 * @param parentProps 父组件已抽取的 props（原地补充）。
 * @param parentEmits 父组件已抽取的 emits（原地补充）。
 * @param allDefs 父组件目录收集到的全部类型定义（含子组件类型，src 根扫描已覆盖）。
 */
async function mergeForwardedSubComponent(
  parentSfcPath: string,
  parentProps: PropDef[],
  parentEmits: EmitDef[],
  allDefs: TypeDefInfo[],
): Promise<void> {
  let parentSrc: string
  try {
    parentSrc = readFileSync(parentSfcPath, 'utf8')
  }
  catch {
    return
  }
  // 只合并「真正接收 v-bind="$attrs" 的那个子组件」的契约，避免父模板 import 了
  // 多个子组件时把全部子组件 props 误并入父对外 API。
  // 1. 找到模板里带 v-bind="$attrs" 的元素，取其标签名（局部组件名）。
  const subDir = dirname(parentSfcPath)
  const tagNames = new Set<string>()
  for (const m of Array.from(parentSrc.matchAll(/<([A-Za-z][\w.-]*)\b[^>]*\bv-bind\s*=\s*["']\$attrs["']/g)))
    tagNames.add(m[1])
  if (!tagNames.size)
    return
  // 2. 把局部组件名映射到其 import 的 .vue 路径（仅同目录相对导入）。
  const importRe = /import\s+(\w+)\s+from\s+["'](\.\/[^"']+\.vue)["']/g
  const nameToPath = new Map<string, string>()
  for (const m of Array.from(parentSrc.matchAll(importRe)))
    nameToPath.set(m[1], join(subDir, m[2]))
  // 3. 仅保留「接收 $attrs 的标签」对应的子组件路径。
  const subPaths = new Set<string>()
  for (const tag of Array.from(tagNames)) {
    const p = nameToPath.get(tag)
    if (p)
      subPaths.add(p)
  }
  if (!subPaths.size)
    return

  const existingProp = new Set(parentProps.map(p => p.name))
  const existingEmit = new Set(parentEmits.map(e => e.name))
  for (const subPath of Array.from(subPaths)) {
    let subDoc: RawDoc
    try {
      subDoc = await parse(subPath) as RawDoc
    }
    catch (err) {
      // 转发型子组件承载核心 props（如 columns），解析失败不能静默丢弃，
      // 否则会重现「columns 契约丢失」的 bug。显式抛出带上下文的错误。
      throw new Error(`解析 $attrs 转发子组件失败：${subPath}（父组件 ${parentSfcPath}）`, { cause: err })
    }
    const subProps = mapProps(subDoc.props ?? [])
    backfillPropTypesFromInterface(subProps, subPath, allDefs)
    for (const p of subProps) {
      if (existingProp.has(p.name))
        continue
      existingProp.add(p.name)
      parentProps.push(p)
    }
    for (const e of mapEmits(subDoc.events ?? [])) {
      if (existingEmit.has(e.name))
        continue
      existingEmit.add(e.name)
      parentEmits.push(e)
    }
  }
}

/**
 * 解析单个 SFC 文件为组件契约。
 * @param filePath SFC 绝对或相对路径。
 * @param packageName 所属包名，写入契约用于来源可追溯。
 * @param exportName 公共入口导出名，displayName 不可靠时用于稳定组件名。
 */
export async function extractContract(filePath: string, packageName: string, exportName?: string): Promise<ComponentContract> {
  const doc = await parse(filePath) as RawDoc
  const emits = mapEmits(doc.events ?? [])
  const props = mapProps(doc.props ?? [])
  const sourceFile = doc.sourceFiles?.[0] ?? filePath

  // 扫描组件目录的全部本地类型定义（interface / type alias），含 SFC 内联别名
  const allDefs = collectTypeDefs(filePath)

  // vue-docgen 对 `defineProps<导入接口>()` 写法会把 prop 类型报成 unknown，
  // 丢失「columns 是 PopoverTableColumn[]」这层关键信息。这里从 SFC 抽出 defineProps 的
  // 泛型接口名，回查其字段类型，按 prop 名回填真实类型与类型引用，驱动后续展开。
  backfillPropTypesFromInterface(props, filePath, allDefs)

  // 合并被父组件通过 v-bind="$attrs" 透传的内部子组件（如 PopoverTableSelectBase）的 props/emits，
  // 它们对使用者而言就是外层组件对外 API 的一部分（columns 等核心配置项即源于此）。
  await mergeForwardedSubComponent(filePath, props, emits, allDefs)

  // 收集 props 实际引用到的自定义类型名集合（剥离修饰后的裸名）
  const referenced = new Set<string>()
  for (const p of props) {
    for (const ref of p.typeRefs)
      referenced.add(ref)
  }

  // 仅保留被 props 引用到（含传递闭包）的本地类型定义，去噪、控制上下文体积
  const typeDefs = filterReachableDefs(allDefs, referenced)

  // #2 类型展开补强：props 引用了、但本地定义缺失或字段为空（如 element-plus 的 PopoverProps、
  // 同包跨目录的 ScheduleOptions）的类型，从组件类型源文件的 import 出发跟随到来源展开字段。
  // 深度 1 层：只补 props 直接引用的这一层，第三方再嵌套保留类型字符串。
  const defByName = new Map(typeDefs.map(d => [d.name, d]))
  const needExternal = Array.from(referenced).filter((n) => {
    const d = defByName.get(n)
    return !d || d.fields.length === 0
  })
  if (needExternal.length) {
    const typeSourceFiles = collectTypeSourceFiles(filePath)
    for (const ext of resolveExternalTypeDefs(typeSourceFiles, needExternal)) {
      const existing = defByName.get(ext.name)
      // 仅在本地版本缺失或无字段、且外部解析确有字段时覆盖；解析失败的占位仅在本地完全缺失时加入，
      // 以便 UI 显示「展不开 + 原因」而非凭空消失。
      if (!existing) {
        typeDefs.push(ext)
        defByName.set(ext.name, ext)
      }
      else if (existing.fields.length === 0 && ext.fields.length > 0) {
        existing.fields = ext.fields
        existing.raw = ext.raw
      }
    }
  }

  const name = resolveComponentName(filePath, doc.displayName, exportName)
  // 插槽优先从 `<Comp>Slots` 契约接口派生（vue-docgen 对动态插槽 `#[name]` 会误报伪插槽）；
  // 契约缺失时回退 vue-docgen 解析结果，不静默丢插槽。
  const slots = deriveSlotsFromContract(name, allDefs) ?? mapSlots(doc.slots ?? [])

  return {
    name,
    packageName,
    description: doc.description ?? '',
    props,
    emits,
    slots,
    models: deriveModels(emits),
    sourceFile,
    typeDefs,
  }
}

/**
 * 用 `defineProps<XXX>()` 泛型类型的字段类型，回填 vue-docgen 报成 unknown 的 prop 类型。
 *
 * XXX 可能是 interface，也可能是 SFC 内联别名（如 `Omit<XxxProps, 'k'>`、`Pick<...>`、交叉类型）。
 * 通过 resolveNamedTypeFields 跟随别名与工具类型解析到最终字段集合，再按 prop 名匹配回填，
 * 并重算 typeRefs 驱动后续类型展开。找不到类型或字段时按缺省保留原值，不抛错（边界容错）。
 */
function backfillPropTypesFromInterface(props: PropDef[], sfcPath: string, allDefs: TypeDefInfo[]): void {
  const propsTypeName = extractDefinePropsTypeName(sfcPath)
  if (!propsTypeName)
    return
  const byName = new Map(allDefs.map(d => [d.name, d]))
  const fields = resolveNamedTypeFields(propsTypeName, byName)
  if (!fields.length)
    return
  const fieldByName = new Map(fields.map(f => [f.name, f]))
  for (const p of props) {
    const field = fieldByName.get(p.name)
    if (!field)
      continue
    // 本地类型字段的原始类型文本（如 `PopoverTableColumn[]`）信息最完整：
    // vue-docgen 会把类型归一成 `Array`/`union`/`unknown` 等降级名，丢失元素类型。
    // 只要本地类型能解析到该字段，就用其原始类型覆盖，并重算 typeRefs 驱动展开。
    p.type = field.type
    p.typeRefs = extractTypeRefs(field.type)
    if (!p.description && field.description)
      p.description = field.description
  }
}

/**
 * 从全部类型定义中，递归保留被 props 引用到的类型及其字段再引用的类型（传递闭包）。
 * 例：columns: PopoverTableColumn[] → 纳入 PopoverTableColumn；
 *     其 formatter 字段引用 PopoverTableRow → 一并纳入。
 * 控制上下文体积，只展开真正可达的结构。
 */
function filterReachableDefs(allDefs: TypeDefInfo[], rootRefs: Set<string>): TypeDefInfo[] {
  const byName = new Map(allDefs.map(d => [d.name, d]))
  const kept = new Map<string, TypeDefInfo>()
  const queue = Array.from(rootRefs)

  while (queue.length) {
    const name = queue.shift() as string
    if (kept.has(name))
      continue
    const def = byName.get(name)
    if (!def)
      continue
    kept.set(name, def)
    // 沿字段类型继续展开传递引用
    for (const f of def.fields) {
      for (const ref of extractTypeRefs(f.type)) {
        if (!kept.has(ref) && byName.has(ref))
          queue.push(ref)
      }
    }
  }

  return Array.from(kept.values())
}

/**
 * 批量解析多个 SFC。单个文件解析失败时抛出带文件上下文的错误，不静默跳过缺失契约。
 */
export async function extractContracts(
  files: { exportName?: string, filePath: string, packageName: string }[],
): Promise<ComponentContract[]> {
  const results: ComponentContract[] = []
  for (const { exportName, filePath, packageName } of files) {
    try {
      results.push(await extractContract(filePath, packageName, exportName))
    }
    catch (err) {
      throw new Error(`extractContract failed for ${filePath}: ${(err as Error).message}`, { cause: err })
    }
  }
  return results
}
