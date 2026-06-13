import type { ComponentContract, EmitDef, ModelDef, PropDef, SlotDef, TypeDefInfo } from './types'
import { readdirSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parse } from 'vue-docgen-api'
import { extractDefinePropsTypeName, extractTypeRefs, parseTypeDefs } from './type-resolver'

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

/** 从 SFC 文件路径推断组件名：displayName 不可靠（src/index.vue 会得到 "src"）时用目录名兜底。 */
function resolveComponentName(filePath: string, displayName?: string): string {
  if (displayName && displayName !== 'src' && displayName !== 'index')
    return displayName
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
  return defs
}

/**
 * 解析单个 SFC 文件为组件契约。
 * @param filePath SFC 绝对或相对路径。
 * @param packageName 所属包名，写入契约用于来源可追溯。
 */
export async function extractContract(filePath: string, packageName: string): Promise<ComponentContract> {
  const doc = await parse(filePath) as RawDoc
  const emits = mapEmits(doc.events ?? [])
  const props = mapProps(doc.props ?? [])
  const sourceFile = doc.sourceFiles?.[0] ?? filePath

  // 扫描组件目录的全部本地类型定义（interface / type alias）
  const allDefs = collectTypeDefs(filePath)

  // vue-docgen 对 `defineProps<导入接口>()` 写法会把 prop 类型报成 unknown，
  // 丢失「columns 是 PopoverTableColumn[]」这层关键信息。这里从 SFC 抽出 defineProps 的
  // 泛型接口名，回查其字段类型，按 prop 名回填真实类型与类型引用，驱动后续展开。
  backfillPropTypesFromInterface(props, filePath, allDefs)

  // 收集 props 实际引用到的自定义类型名集合（剥离修饰后的裸名）
  const referenced = new Set<string>()
  for (const p of props) {
    for (const ref of p.typeRefs)
      referenced.add(ref)
  }

  // 仅保留被 props 引用到（含传递闭包）的本地类型定义，去噪、控制上下文体积
  const typeDefs = filterReachableDefs(allDefs, referenced)

  return {
    name: resolveComponentName(filePath, doc.displayName),
    packageName,
    description: doc.description ?? '',
    props,
    emits,
    slots: mapSlots(doc.slots ?? []),
    models: deriveModels(emits),
    sourceFile,
    typeDefs,
  }
}

/**
 * 用 `defineProps<XXX>()` 泛型接口的字段类型，回填 vue-docgen 报成 unknown 的 prop 类型。
 * 按 prop 名匹配接口字段；命中且原类型为 unknown/空时覆盖，并重算 typeRefs 驱动展开。
 * 找不到接口或字段时按缺省保留原值，不抛错（边界容错，不静默吞业务数据）。
 */
function backfillPropTypesFromInterface(props: PropDef[], sfcPath: string, allDefs: TypeDefInfo[]): void {
  const propsTypeName = extractDefinePropsTypeName(sfcPath)
  if (!propsTypeName)
    return
  const iface = allDefs.find(d => d.name === propsTypeName)
  if (!iface)
    return
  const fieldByName = new Map(iface.fields.map(f => [f.name, f]))
  for (const p of props) {
    const field = fieldByName.get(p.name)
    if (!field)
      continue
    // 本地接口字段的原始类型文本（如 `PopoverTableColumn[]`）信息最完整：
    // vue-docgen 会把类型归一成 `Array`/`union`/`TSIndexedAccessType` 等降级名，丢失元素类型。
    // 只要本地接口能解析到该字段，就用其原始类型覆盖，并重算 typeRefs 驱动展开。
    p.type = field.type
    p.typeRefs = extractTypeRefs(field.type)
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
  files: { filePath: string, packageName: string }[],
): Promise<ComponentContract[]> {
  const results: ComponentContract[] = []
  for (const { filePath, packageName } of files) {
    try {
      results.push(await extractContract(filePath, packageName))
    }
    catch (err) {
      throw new Error(`extractContract failed for ${filePath}: ${(err as Error).message}`, { cause: err })
    }
  }
  return results
}
