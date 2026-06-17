import type {
  ComponentMeta,
  MetaCheckerOptions,
  PropertyMeta,
  PropertyMetaSchema,
} from 'vue-component-meta'
import type { EmitDef, ExposeDef, PropDef, SlotDef, TypeDefInfo, TypeFieldDef } from './types'
import { createChecker } from 'vue-component-meta'

/**
 * 基于 vue-component-meta（Volar language service，真 TS type checker）的契约提取核心。
 *
 * 取代旧的 vue-docgen-api + 手写 type-resolver/external-type-resolver：
 * checker 直接解析 defineProps<导入接口>() / Omit/Pick 别名 / 第三方类型，prop 类型不再退化 unknown。
 * 类型展开由 meta 的嵌套 schema 树承载，本模块把它拍平回项目既有的扁平 TypeDefInfo 结构，
 * 保持下游（generator/indexer/DetailView/protocol）零改动。
 *
 * 设计取舍：
 * - schema.ignore 在第三方 / DOM 类型边界停止展开（实证：不设则单组件 schema 达 66MB~191MB），
 *   自有类型完整深度展开。等价旧策略「深度1层、第三方留类型字符串」，但改为声明式可审计配置。
 * - checker 单例复用：建 program 成本高（首组件 ~4.6s），同一 tsconfig 下复用，批量提取仅付一次。
 */

/**
 * 第三方 / DOM / 框架类型边界：命中则不展开其内部结构，仅在 prop.type 保留类型名字符串。
 * 自有业务类型（PopoverTableColumn、ThrottleOrDebounceOptions 等）不在此列，完整展开。
 */
const IGNORE_TYPE_PATTERNS: RegExp[] = [
  /Props$/, // element-plus PopoverProps / InputProps 等组件 props 类型
  /Instance$/, // ElInput Instance 等组件实例类型
  /Emits$/, // 第三方组件 emits 类型
  /HTMLAttributes$/, // 原生属性类型
  /^Readonly$/,
  /^CSSProperties$/,
  /Element$/, // HTMLElement / Element / SVGElement
  /Event$/, // MouseEvent / KeyboardEvent 等
  /^Ref$/,
  /^ComponentPublicInstance$/,
  /^VNode/,
]

/** TS 内建工具/基础类型名，从 typeRefs 中排除（与旧 extractTypeRefs 口径一致）。 */
const BUILTIN_TYPE_NAMES = new Set([
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

/** 默认 meta checker 选项：forceUseTs + schema.ignore 边界裁剪。 */
export function defaultCheckerOptions(): MetaCheckerOptions {
  return {
    forceUseTs: true,
    printer: { newLine: 1 },
    schema: {
      ignore: [
        (name: string) => IGNORE_TYPE_PATTERNS.some(re => re.test(name)),
      ],
    },
  }
}

export type MetaChecker = ReturnType<typeof createChecker>

/** 按 tsconfig 创建（复用）一个 meta checker。批量提取应缓存返回值。 */
export function createMetaChecker(tsconfigPath: string, options?: MetaCheckerOptions): MetaChecker {
  return createChecker(tsconfigPath, options ?? defaultCheckerOptions())
}

/**
 * 从类型字符串中提取引用的项目内自定义类型名（剥离 []、Partial<>、| null、联合等修饰）。
 * 与旧 type-resolver.extractTypeRefs 口径一致，供 prop.typeRefs 收集与下游展开驱动。
 */
export function extractTypeRefs(typeStr: string): string[] {
  if (!typeStr || typeStr === 'unknown' || typeStr === 'any')
    return []
  const matches = typeStr.match(/[A-Z]\w*/g) ?? []
  return Array.from(new Set(matches)).filter(name => !BUILTIN_TYPE_NAMES.has(name))
}

/** schema 是否为可展开的对象节点（含命名字段）。 */
function isObjectSchema(
  s: PropertyMetaSchema,
): s is { kind: 'object', type: string, schema?: Record<string, PropertyMeta> } {
  return typeof s === 'object' && s.kind === 'object' && !!s.schema
}

/**
 * 递归遍历 meta 的 schema 树，把每个 `kind:object` 节点产出为一个扁平 TypeDefInfo。
 * - 自有类型完整展开（schema 含 fields）；
 * - 被 schema.ignore 截断的第三方类型不会有 object 节点，自然不产出 TypeDefInfo（等价旧「留字符串」）；
 * - 防环：按类型名去重，已收集的类型不重复下钻。
 *
 * @param schema     prop / 字段的 schema（可能是 string | enum | array | object）。
 * @param collected  累积的类型定义（按 name 去重）。
 */
function collectTypeDefsFromSchema(
  schema: PropertyMetaSchema | undefined,
  collected: Map<string, TypeDefInfo>,
): void {
  if (!schema || typeof schema === 'string')
    return

  // enum / array：继续下钻其子 schema（联合分支、数组元素类型）
  if (schema.kind === 'enum' || schema.kind === 'array' || schema.kind === 'event') {
    for (const child of schema.schema ?? [])
      collectTypeDefsFromSchema(child, collected)
    return
  }

  // object：为「命名自有类型」产出 TypeDefInfo；无论是否命名，都下钻成员以展开嵌套自有类型。
  if (isObjectSchema(schema)) {
    const members = schema.schema ?? {}
    const typeName = bareTypeName(schema.type)
    // 仅为项目内自定义命名类型产出定义；匿名对象字面量（如 `{ col: TableColumn }`）取不到裸名，
    // 不产出包装层定义，但仍需下钻其成员，否则嵌套的具名类型（TableColumn）会漏收。
    if (typeName && !collected.has(typeName) && !BUILTIN_TYPE_NAMES.has(typeName)) {
      const fields: TypeFieldDef[] = []
      for (const key of Object.keys(members)) {
        const member = members[key]
        fields.push({
          name: member.name,
          type: member.type,
          optional: !member.required,
          description: member.description ?? '',
        })
      }
      collected.set(typeName, {
        name: typeName,
        kind: 'interface',
        fields,
        raw: renderRawFromFields(typeName, fields),
      })
    }
    // 下钻字段类型，展开嵌套自有类型（命名与匿名对象均执行，确保嵌套具名类型不漏收）
    for (const key of Object.keys(members))
      collectTypeDefsFromSchema(members[key].schema, collected)
  }
}

/** 从 schema.type（可能形如 `PopoverTableColumn[]`、`Foo | undefined`）取裸类型名。 */
function bareTypeName(typeStr: string): string | null {
  const refs = extractTypeRefs(typeStr)
  return refs[0] ?? null
}

/** 由字段集合重建 interface 原文（作为全文检索语料与无字段兜底，对齐旧 TypeDefInfo.raw）。 */
function renderRawFromFields(name: string, fields: TypeFieldDef[]): string {
  const lines = fields.map((f) => {
    const opt = f.optional ? '?' : ''
    const desc = f.description ? `  /** ${f.description} */\n` : ''
    return `${desc}  ${f.name}${opt}: ${f.type}`
  })
  return `interface ${name} {\n${lines.join('\n')}\n}`
}

/** 把 meta.props（已过滤 global）映射为 PropDef，并收集 typeRefs 与展开类型。 */
export function mapMetaProps(
  metaProps: PropertyMeta[],
  collected: Map<string, TypeDefInfo>,
): PropDef[] {
  const result: PropDef[] = []
  for (const p of metaProps) {
    if (p.global)
      continue
    collectTypeDefsFromSchema(p.schema, collected)
    result.push({
      name: p.name,
      type: p.type,
      required: p.required,
      defaultValue: p.default ?? null,
      description: p.description ?? '',
      typeRefs: extractTypeRefs(p.type),
    })
  }
  return result
}

/** 把 meta.events 映射为 EmitDef。meta 的 event.type 形如 `[value: string]`。 */
export function mapMetaEvents(meta: ComponentMeta): EmitDef[] {
  return meta.events.map(e => ({
    name: e.name,
    payloadType: e.type,
    description: e.description ?? '',
  }))
}

/** 把 meta.slots 映射为 SlotDef（具名插槽；动态插槽由后处理从契约接口补）。 */
export function mapMetaSlots(meta: ComponentMeta): SlotDef[] {
  return meta.slots.map(s => ({
    name: s.name,
    scopeType: s.type,
    description: s.description ?? '',
  }))
}

/** 把 meta.exposed 映射为 ExposeDef。 */
export function mapMetaExposed(meta: ComponentMeta): ExposeDef[] {
  return meta.exposed.map(e => ({
    name: e.name,
    type: e.type,
    description: e.description ?? '',
  }))
}
