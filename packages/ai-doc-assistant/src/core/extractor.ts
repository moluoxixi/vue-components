import type { MetaChecker } from './meta-extractor'
import type { ComponentContract, EmitDef, ModelDef, PropDef, SlotDef, TypeDefInfo, TypeFieldDef } from './types'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import process from 'node:process'
import {
  createMetaChecker,
  extractTypeRefs,
  mapMetaEvents,
  mapMetaExposed,
  mapMetaProps,
  mapMetaSlots,
} from './meta-extractor'
import {
  collectLocalTypeDefs,
  extractDefineAttrsTypeName,
} from './type-source'

export { createMetaChecker } from './meta-extractor'

/**
 * 组件契约提取（vue-component-meta 引擎）。
 *
 * 主路径：用 meta checker（真 TS type checker）解析 props/emits/slots/exposed 与类型展开。
 * 后处理（meta 能力盲区）：
 * - 动态插槽：meta 丢弃索引签名/模板字面量键插槽，从 `<Comp>Slots` 契约接口补 `[dynamic]` 说明。
 * - defineAttrs：meta 完全不体现，从 SFC 抽 `defineAttrs<T>()` 泛型名再解析 T 字段，单独成 attrs 段。
 * - $attrs 定向转发：meta 不跟 `v-bind="$attrs"`，对接收 $attrs 的子组件单独跑 meta 合并 props/emits，
 *   合并项打 forwardedFrom 角标。
 */

/** PascalCase 公共导出名通常比插件运行时 name 更适合作为文档检索名。 */
function isPascalCase(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name)
}

/**
 * 把模板标签名归一为 PascalCase 组件名，对齐 import 绑定名。
 * 模板可写 PascalCase（<PopoverTableSelectBase>）或 kebab-case（<popover-table-select-base>），
 * 后者按连字符切分后首字母大写拼接。已是 PascalCase 时原样返回。
 */
function toPascalCase(tag: string): string {
  if (!tag.includes('-'))
    return tag
  return tag
    .split('-')
    .filter(Boolean)
    .map(seg => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('')
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
 * 从插槽契约接口（约定名 `<Comp>Slots`）派生动态插槽说明。
 *
 * meta 已给出具名插槽（含作用域类型），但会丢弃 `[name: string]` 索引签名 / 模板字面量键表达的
 * 动态插槽。组件真实契约写在 `src/types/slots.ts` 的 `<Comp>Slots` interface 里。这里只补 meta
 * 未覆盖的部分：具名键中 meta 没给出的、以及索引签名 → 一个 `[dynamic]` 动态插槽说明。
 * @param componentName 组件名，用于拼出契约接口名 `<Comp>Slots`。
 * @param localDefs 组件目录收集到的全部本地类型定义（含 SFC 内联）。
 * @param metaSlots meta 已解析出的具名插槽（用于去重，避免重复声明）。
 */
function deriveDynamicSlots(
  componentName: string,
  localDefs: TypeDefInfo[],
  metaSlots: SlotDef[],
): SlotDef[] {
  const def = localDefs.find(d => d.name === `${componentName}Slots`)
  if (!def)
    return []
  const existing = new Set(metaSlots.map(s => s.name))
  const extra: SlotDef[] = []
  let hasIndexSignature = false
  for (const f of def.fields) {
    // 索引签名字段在解析时其 name 形如 `[name: string]`，用方括号识别
    if (f.name.startsWith('[')) {
      hasIndexSignature = true
      continue
    }
    // meta 已给出的具名插槽不重复补
    if (existing.has(f.name))
      continue
    extra.push({ name: f.name, scopeType: f.type, description: f.description })
  }
  if (hasIndexSignature && !existing.has('[dynamic]')) {
    extra.push({
      name: '[dynamic]',
      scopeType: 'Record<string, any>',
      description: '按列名动态声明的单元格插槽（插槽名取自各列 field），作用域参数为该列的行/列/值上下文。',
    })
  }
  return extra
}

/**
 * 解析 `defineAttrs<T>()` 声明的开放透传属性字段。
 * meta 不体现 defineAttrs，从 SFC 抽泛型名 T，再从本地类型定义取 T 的字段。
 * 无 defineAttrs 或解析不到字段时返回 undefined（不产出空 attrs 段）。
 */
function extractAttrs(sfcPath: string, localDefs: TypeDefInfo[]): TypeFieldDef[] | undefined {
  const attrsTypeName = extractDefineAttrsTypeName(sfcPath)
  if (!attrsTypeName)
    return undefined
  const def = localDefs.find(d => d.name === attrsTypeName)
  if (!def || !def.fields.length)
    return undefined
  return def.fields
}

/**
 * 传递闭包补强：meta 把函数签名渲染为类型字符串（如 `(row: TableRow) => string`），不会为其中
 * 引用的类型产出 schema object 节点，导致「仅出现在函数签名里」的自有类型漏收。这里用本地类型源补回：
 * 反复遍历已收集类型的字段类型文本，凡引用到本地有定义、但 collected 缺失的类型名，纳入并继续展开，
 * 直至闭包稳定（无新增）。只补本地有定义的类型，第三方/内建仍按字符串保留。
 * @param collected 已由 meta schema 展开的类型定义（原地补充）。
 * @param localDefs 组件目录的全部本地类型定义（语法解析所得），作为补全来源。
 */
function backfillTransitiveClosure(
  collected: Map<string, TypeDefInfo>,
  localDefs: TypeDefInfo[],
): void {
  const localByName = new Map(localDefs.map(d => [d.name, d]))
  let changed = true
  while (changed) {
    changed = false
    for (const def of Array.from(collected.values())) {
      for (const f of def.fields) {
        for (const ref of extractTypeRefs(f.type)) {
          if (collected.has(ref) || !localByName.has(ref))
            continue
          collected.set(ref, localByName.get(ref) as TypeDefInfo)
          changed = true
        }
      }
    }
  }
}

/**
 * 把通过 `v-bind="$attrs"` 定向转发的子组件契约合并进父组件。
 *
 * 外层组件常把核心 props（如 columns）声明在内部子组件上，再用 `v-bind="$attrs"` 整体转发；
 * 对使用者而言这些是父组件对外 API 的一部分，必须并入。meta 不跟 $attrs，故单独对接收 $attrs 的
 * 子组件跑 meta，把其 props/emits 去重合并到父契约，合并的 props 打 forwardedFrom 角标。
 *
 * @param parentSfcPath 父组件 SFC 绝对路径。
 * @param parentSrc 父组件 SFC 源码。
 * @param parentProps 父组件已抽取的 props（原地补充）。
 * @param parentEmits 父组件已抽取的 emits（原地补充）。
 * @param checker meta checker（复用）。
 * @param collected 类型展开累积容器（子组件类型一并展开）。
 */
function mergeForwardedSubComponent(
  parentSfcPath: string,
  parentSrc: string,
  parentProps: PropDef[],
  parentEmits: EmitDef[],
  checker: MetaChecker,
  collected: Map<string, TypeDefInfo>,
): void {
  // 1. 找到模板里带 v-bind="$attrs" 的元素标签名（原始写法）。
  //    Vue 约定：原生 HTML 元素为小写无连字符（div/span/button），自定义组件为 PascalCase 或含连字符的
  //    kebab-case（popover-table-select-base）。原生元素的 v-bind="$attrs" 是把属性透传到 DOM，
  //    无子组件契约可合并，跳过；只有「看起来是组件」的标签才需定位 import 并合并。
  const rawTags = new Set<string>()
  for (const m of Array.from(parentSrc.matchAll(/<([A-Za-z][\w.-]*)\b[^>]*\bv-bind\s*=\s*["']\$attrs["']/g)))
    rawTags.add(m[1])
  if (!rawTags.size)
    return
  // 仅保留组件标签（首字母大写，或含连字符的自定义元素），归一为 PascalCase 对齐 import 绑定名。
  const componentTags = new Set<string>()
  for (const tag of Array.from(rawTags)) {
    const isComponent = /^[A-Z]/.test(tag) || tag.includes('-')
    if (isComponent)
      componentTags.add(toPascalCase(tag))
  }
  if (!componentTags.size)
    return
  // 2. 收集组件名 → import 模块说明符（default import）。区分两类来源：
  //    - 本地相对 .vue（./ 或 ../）：能在 program 内定位、可解析契约 → 合并；
  //    - 第三方裸模块（element-plus 等）、路径别名（@/）、全局注册组件（无 import）：
  //      meta 无法跨包/越界解析其 props，且 v-bind="$attrs" 转发到第三方组件是常见合法写法 → 跳过。
  const subDir = dirname(parentSfcPath)
  const nameToSpecifier = new Map<string, string>()
  for (const m of Array.from(parentSrc.matchAll(/import\s+(\w+)\s+from\s+["']([^"']+)["']/g)))
    nameToSpecifier.set(m[1], m[2])
  // 3. 仅保留能定位到本地相对 .vue import 的组件标签；其余（第三方/别名/全局）跳过，不抛错。
  const subPaths = new Set<string>()
  for (const tag of Array.from(componentTags)) {
    const specifier = nameToSpecifier.get(tag)
    // 无 default import（全局组件）或非相对 .vue（第三方裸模块、别名）：无法定位本地契约，跳过。
    if (!specifier || !/^\.\.?\/.+\.vue$/.test(specifier))
      continue
    subPaths.add(resolvePath(subDir, specifier))
  }
  if (!subPaths.size)
    return

  const existingProp = new Set(parentProps.map(p => p.name))
  const existingEmit = new Set(parentEmits.map(e => e.name))
  for (const subPath of Array.from(subPaths)) {
    let subMeta
    try {
      subMeta = checker.getComponentMeta(subPath)
    }
    catch (err) {
      // 转发型子组件承载核心 props（如 columns），解析失败不能静默丢弃。
      throw new Error(`解析 $attrs 转发子组件失败：${subPath}（父组件 ${parentSfcPath}）`, { cause: err })
    }
    const subName = resolveComponentName(subPath, subMeta.name)
    const subProps = mapMetaProps(subMeta.props, collected)
    for (const p of subProps) {
      if (existingProp.has(p.name))
        continue
      existingProp.add(p.name)
      parentProps.push({ ...p, forwardedFrom: subName })
    }
    for (const e of mapMetaEvents(subMeta)) {
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
 * @param checker meta checker（批量提取复用同一实例）。
 * @param exportName 公共入口导出名，displayName 不可靠时用于稳定组件名。
 */
export function extractContractWithChecker(
  filePath: string,
  packageName: string,
  checker: MetaChecker,
  exportName?: string,
): ComponentContract {
  const meta = checker.getComponentMeta(filePath)

  const collected = new Map<string, TypeDefInfo>()
  const props = mapMetaProps(meta.props, collected)
  const emits = mapMetaEvents(meta)
  const metaSlots = mapMetaSlots(meta)
  const exposed = mapMetaExposed(meta)

  // 后处理需要本地类型源（动态插槽契约 / defineAttrs T）
  const localDefs = collectLocalTypeDefs(filePath)

  // 转发合并与 defineAttrs 都需要 SFC 源码。该文件在上方 getComponentMeta 已被成功读取，
  // 此处直接读取；读失败属真实异常，显式抛出（不静默吞错回退空串掩盖问题）。
  const parentSrc = readFileSync(filePath, 'utf8')

  // $attrs 定向转发合并（meta 不跟 $attrs）
  mergeForwardedSubComponent(filePath, parentSrc, props, emits, checker, collected)

  const name = resolveComponentName(filePath, meta.name, exportName)

  // 动态插槽补全：meta 具名插槽 + 契约接口派生的动态部分
  const slots: SlotDef[] = [...metaSlots, ...deriveDynamicSlots(name, localDefs, metaSlots)]

  // 传递闭包补强：meta 把函数签名（如 `formatter: (row: TableRow) => string`）渲染为字符串，
  // 不会为其中引用的类型产出 schema object 节点，导致 TableRow 这类「仅出现在函数签名里」的
  // 自有类型漏收。这里用已收集的本地类型源补回：遍历已展开类型的字段类型，凡引用到本地有定义、
  // 但 collected 里缺失的类型名，纳入（递归直至闭包稳定）。
  backfillTransitiveClosure(collected, localDefs)

  // defineAttrs 开放透传属性段
  const attrs = extractAttrs(filePath, localDefs)

  const contract: ComponentContract = {
    name,
    packageName,
    description: meta.description ?? '',
    props,
    emits,
    slots,
    models: deriveModels(emits),
    sourceFile: filePath,
    typeDefs: Array.from(collected.values()),
  }
  if (attrs)
    contract.attrs = attrs
  if (exposed.length)
    contract.exposed = exposed
  return contract
}

/**
 * 解析单个 SFC 为组件契约（单文件入口，自建 checker）。
 * 批量场景应优先用 extractContracts 复用 checker，避免每文件重建 program。
 * @param filePath SFC 路径。
 * @param packageName 所属包名。
 * @param exportName 公共入口导出名（可选）。
 * @param tsconfigPath 用于建 program 的 tsconfig 路径（默认组件包 tsconfig）。
 */
export async function extractContract(
  filePath: string,
  packageName: string,
  exportName?: string,
  tsconfigPath?: string,
): Promise<ComponentContract> {
  const checker = createMetaChecker(tsconfigPath ?? resolveTsconfigFor(filePath))
  return extractContractWithChecker(filePath, packageName, checker, exportName)
}

/**
 * 批量解析多个 SFC。按 tsconfig 分组复用 checker，单文件失败抛带上下文错误，不静默跳过。
 */
export async function extractContracts(
  files: { exportName?: string, filePath: string, packageName: string }[],
  tsconfigPath?: string,
): Promise<ComponentContract[]> {
  const results: ComponentContract[] = []
  // 按 tsconfig 分组复用 checker（同包组件共享 program）
  const checkerByConfig = new Map<string, MetaChecker>()
  const getChecker = (cfg: string): MetaChecker => {
    let c = checkerByConfig.get(cfg)
    if (!c) {
      c = createMetaChecker(cfg)
      checkerByConfig.set(cfg, c)
    }
    return c
  }

  for (const { exportName, filePath, packageName } of files) {
    const cfg = tsconfigPath ?? resolveTsconfigFor(filePath)
    try {
      results.push(extractContractWithChecker(filePath, packageName, getChecker(cfg), exportName))
    }
    catch (err) {
      throw new Error(`extractContract failed for ${filePath}: ${(err as Error).message}`, { cause: err })
    }
  }
  return results
}

/**
 * 为 SFC 解析其所属包的 tsconfig。从 SFC 向上找到含 tsconfig.app.json / tsconfig.json 的包根。
 * meta checker 需要能解析该文件的 program 配置；找不到时回退到当前工作目录的 tsconfig.json。
 */
function resolveTsconfigFor(sfcPath: string): string {
  let dir = dirname(sfcPath)
  for (let prev = ''; dir && dir !== prev; prev = dir, dir = dirname(dir)) {
    for (const cand of ['tsconfig.app.json', 'tsconfig.json']) {
      const full = `${dir}/${cand}`
      if (existsSync(full))
        return full
    }
  }
  return `${process.cwd()}/tsconfig.json`
}
