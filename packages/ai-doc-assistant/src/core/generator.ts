import type { ComponentContract, PropDef, TypeDefInfo } from './types'

/**
 * 把组件契约渲染为「可检索正文」：自然语言化的公共契约描述。
 * 默认 content 用它做关键词 topK；vector 增强路径再把它作为 embedding/BM25 语料。
 */
export function renderSearchableDoc(c: ComponentContract): string {
  const lines: string[] = []
  lines.push(`组件 ${c.name}（来自 ${c.packageName}）`)
  if (c.description)
    lines.push(c.description)

  if (c.props.length) {
    lines.push('Props：')
    for (const p of c.props) {
      const req = p.required ? '必填' : '可选'
      const def = p.defaultValue !== null ? `，默认 ${p.defaultValue}` : ''
      const desc = p.description ? `——${p.description}` : ''
      lines.push(`- ${p.name}: ${p.type}（${req}${def}）${desc}`)
    }
  }
  if (c.emits.length) {
    lines.push('事件：')
    for (const e of c.emits)
      lines.push(`- ${e.name}(${e.payloadType})${e.description ? `——${e.description}` : ''}`)
  }
  if (c.slots.length) {
    lines.push('插槽：')
    for (const s of c.slots)
      lines.push(`- ${s.name}${s.scopeType ? `（作用域 ${s.scopeType}）` : ''}${s.description ? `——${s.description}` : ''}`)
  }
  if (c.models.length)
    lines.push(`v-model：${c.models.map(m => `${m.name}: ${m.type}`).join('，')}`)

  // 展开的关联类型定义：把 columns: PopoverTableColumn[] 这类结构化 prop 的字段口径
  // 写进正文，使「某一列/某个对象字段怎么配」有据可依（方案 A 的检索语料落点）。
  if (c.typeDefs.length) {
    lines.push('相关类型定义：')
    for (const t of c.typeDefs) {
      if (t.fields.length) {
        lines.push(`- ${t.name}（${t.kind === 'interface' ? '接口' : '类型'}）字段：`)
        for (const f of t.fields) {
          const opt = f.optional ? '可选' : '必填'
          const desc = f.description ? `——${f.description}` : ''
          lines.push(`  - ${f.name}: ${f.type}（${opt}）${desc}`)
        }
      }
      else {
        // 无结构化字段（如联合/别名类型）时，回退到原文定义保证信息不丢失
        lines.push(`- ${t.name} = ${t.raw}`)
      }
    }
  }

  return lines.join('\n')
}

/** 为单个标量字段/类型生成有意义的样例字面量（用于结构化对象的字段值）。 */
function sampleScalar(typeText: string, fieldName: string, rowIndex = 0): string {
  const t = typeText.toLowerCase()
  const fn = fieldName.toLowerCase()
  // 联合字面量类型（如 'left' | 'center' | 'right'）取第一个字面量
  const unionLiteral = typeText.match(/'([^']+)'/)
  if (unionLiteral && t.includes('|'))
    return `'${unionLiteral[1]}'`
  if (t.includes('boolean'))
    return 'false'
  if (t.includes('number'))
    return String(18 + rowIndex)
  if (t.includes('function') || t.includes('=>'))
    return '() => {}'
  // 标识符类字段（列定义的 field/prop/key/dataIndex）：给典型列名，让示例贴近真实表格场景
  if (/^(?:field|prop|key|dataindex|dataindexkey|name|value)$/.test(fn)) {
    const cols = ['name', 'price']
    return `'${cols[rowIndex] ?? `col${rowIndex + 1}`}'`
  }
  // 标题/标签类字段：给可读的中文列标题
  if (/title|label|header|text/.test(fn)) {
    const titles = ['姓名', '价格']
    return `'${titles[rowIndex] ?? `列${rowIndex + 1}`}'`
  }
  // 字符串及兜底：用字段名 + 行号生成可辨识的占位
  return `'${fieldName}${rowIndex > 0 ? rowIndex + 1 : ''}'`
}

/**
 * 为「结构化数组 prop」（如 columns: PopoverTableColumn[]）生成真实可运行的样例数组。
 *
 * 标准示例诉求：预览要渲染出有内容的组件，空 `[]` 占位无法体现用法。
 * 故按引用类型的字段结构生成 2 个样例对象，必填字段必给值，
 * 再补 1~2 个有信息量的可选字段（title/label 等），避免无意义的全字段堆砌。
 *
 * @param typeDef 该数组元素引用的自定义类型（含字段明细）
 * @param dynamicSlotField 若组件支持按 field 命名的动态插槽，给对应列补 `slots.default`。
 * @returns 样例对象数组的源码片段（多行缩进），如 `[\n  { field: 'name', title: '姓名' },\n  ...\n]`
 */
function sampleStructuredArray(typeDef: TypeDefInfo, dynamicSlotField?: string): string {
  const required = typeDef.fields.filter(f => !f.optional)
  // 选取展示字段：必填字段 + 最多 1 个有代表性的可选字符串字段（title/label/name）
  const niceOptional = typeDef.fields.find(
    f => f.optional && /string/i.test(f.type) && /title|label|name|text/i.test(f.name),
  )
  const showFields = niceOptional ? [...required, niceOptional] : required
  // 字段为空（无必填）时退回首个字段，仍保证对象非空
  const fields = showFields.length ? showFields : typeDef.fields.slice(0, 1)
  const keyField = required[0] ?? typeDef.fields[0]

  const makeRow = (i: number): string => {
    const parts = fields.map(f => `${f.name}: ${sampleScalar(f.type, f.name, i)}`)
    if (dynamicSlotField && keyField) {
      const keyValue = sampleScalar(keyField.type, keyField.name, i).replace(/^'|'$/g, '')
      if (keyValue === dynamicSlotField)
        parts.push(`slots: { default: '${dynamicSlotField}' }`)
    }
    return `  { ${parts.join(', ')} }`
  }
  return `[\n${makeRow(0)},\n${makeRow(1)},\n]`
}

/**
 * 为「无结构化字段的数据行数组」（如 data: PopoverTableRow[]，PopoverTableRow 是开放 record）
 * 按已知列定义的 field 生成联动样例行，使表格类组件预览真正显示数据。
 *
 * 行的 key 来自列的 field 名（保证 data 与 columns 对齐），值是按 key 语义推断的真实样例数据
 * （如 name→姓名、age→年龄数字），而非把列名当字面量，让预览呈现可读的表格内容。
 *
 * @param fieldNames 列的 field 名列表（来自同组件 columns 样例）
 */
function sampleRowArray(fieldNames: string[]): string {
  // 按 key 语义给两行可读样例值；命中常见列名给贴合数据，否则给「字段名+行号」占位
  const cellValue = (key: string, rowIndex: number): string => {
    const k = key.toLowerCase()
    if (/age|count|num|qty|amount|price|size|width|height/.test(k))
      return String(18 + rowIndex * 2)
    if (/name|user|person/.test(k))
      return `'${['张三', '李四'][rowIndex] ?? `用户${rowIndex + 1}`}'`
    if (/enable|disable|active|checked|selected|visible/.test(k))
      return rowIndex === 0 ? 'true' : 'false'
    return `'${key}${rowIndex + 1}'`
  }
  const makeRow = (i: number): string => {
    const parts = fieldNames.map(name => `${name}: ${cellValue(name, i)}`)
    return `  { ${parts.join(', ')} }`
  }
  return `[\n${makeRow(0)},\n${makeRow(1)},\n]`
}

/** 为单个 prop 生成示例属性值（按类型给合理占位，体现类型提示）。 */
function exampleValueFor(p: PropDef): string {
  const t = p.type.toLowerCase()
  if (p.defaultValue !== null)
    return p.defaultValue
  if (t.includes('boolean'))
    return 'true'
  if (t.includes('number'))
    return '0'
  if (t.includes('array') || t.startsWith('['))
    return '[]'
  if (t.includes('object') || t.startsWith('{'))
    return '{}'
  if (t.includes('function') || t.includes('=>'))
    return '() => {}'
  return `'${p.name}'`
}

/** 示例代码的双语言形态：TS（带类型）与 JS（剥离类型），供 demo 预览块切换查看/复制。 */
export interface ExampleCode {
  /** `<script setup lang="ts">` 版本，含 ref<Type>() 类型标注。 */
  ts: string
  /** `<script setup>` 版本，剥离类型标注（ref(value)）。 */
  js: string
}

/**
 * 生成带类型提示的 SFC 使用示例骨架（确定性，不依赖大模型），同时产出 TS 与 JS 两种形态。
 *
 * 两种形态共享同一套 props 选择、属性绑定、v-model 逻辑，仅 setup 内变量声明的类型标注不同：
 * TS 用 `ref<Type>(value)`，JS 用 `ref(value)`。这样 demo 预览块可让用户切换查看/复制 TS 或 JS。
 *
 * 注意：JS 形态由确定性规则直接生成，不做 TS 源码字符串的正则降级（骨架形态受控、字段简单，
 * 直接按语言分别拼接比事后剥离更可靠，避免复杂泛型/多行类型的正则脆弱性）。
 */
export function renderExample(c: ComponentContract): ExampleCode {
  const typeDefByName = new Map(c.typeDefs.map(t => [t.name, t] as const))

  const isArrayProp = (p: PropDef) => /\[\]/.test(p.type) || /\barray\b/i.test(p.type)
  // prop 引用的「带字段」自定义类型（如 columns → PopoverTableColumn）
  const structTypeOf = (p: PropDef): TypeDefInfo | undefined => {
    for (const ref of p.typeRefs) {
      const td = typeDefByName.get(ref)
      if (td && td.fields.length)
        return td
    }
    return undefined
  }
  // 开放记录类型（无字段定义的 Record 别名，如 PopoverTableRow），用作数据行容器
  const isOpenRecordType = (td: TypeDefInfo | undefined): boolean => !!td && !td.fields.length

  // 列定义类 prop：数组 + 引用带字段类型，可生成结构化样例对象（typically columns）
  const columnsProp = c.props.find(p => isArrayProp(p) && structTypeOf(p))
  const columnsType = columnsProp ? structTypeOf(columnsProp) : undefined
  // 列的「主键字段」（第一个必填字段，typically field）及其在样例两行中的取值，供数据行联动
  const keyField = columnsType?.fields.find(f => !f.optional) ?? columnsType?.fields[0]
  const keyFieldValues = keyField
    ? [sampleScalar(keyField.type, keyField.name, 0), sampleScalar(keyField.type, keyField.name, 1)]
        .map(v => v.replace(/^'|'$/g, ''))
    : []
  const hasDynamicSlot = c.slots.some(s =>
    s.name.includes('dynamic')
    || s.name.includes('[')
    || /动态/.test(`${s.name} ${s.description}`),
  )
  const dynamicSlotName = hasDynamicSlot
    ? (keyFieldValues.find(v => /price|amount|money|total/i.test(v)) ?? keyFieldValues[0])
    : undefined
  // 数据行类 prop：数组但引用的是无字段开放类型（typically data: Row[]），按列主键生成联动行
  const dataProp = c.props.find(
    p => isArrayProp(p) && p !== columnsProp && !structTypeOf(p)
      && p.typeRefs.some(r => isOpenRecordType(typeDefByName.get(r))),
  )

  const requiredProps = c.props.filter(p => p.required)
  // 展示 props：必填 + 结构化数据 prop（columns/data），保证预览渲染出有内容的组件；
  // 二者皆无时退回前 3 个 prop（保持既有骨架行为）。
  const dataProps = [columnsProp, dataProp].filter((p): p is PropDef => !!p)
  let propsToShow = requiredProps.slice()
  for (const dp of dataProps) {
    if (!propsToShow.includes(dp))
      propsToShow.push(dp)
  }
  if (!propsToShow.length)
    propsToShow = c.props.slice(0, 3)

  // 结构化样例值：columns → 样例列对象数组；data → 按列主键联动的样例行；其余 → 占位值
  const structuredValueFor = (p: PropDef): string | null => {
    if (p === columnsProp && columnsType)
      return sampleStructuredArray(columnsType, dynamicSlotName)
    if (p === dataProp && keyFieldValues.length) {
      return sampleRowArray(keyFieldValues)
    }
    return null
  }

  const isStatic = (p: PropDef) => {
    const v = exampleValueFor(p)
    return v.startsWith('\'') || v === 'true' || v === 'false' || /^\d+$/.test(v)
  }
  const attrNameOf = (propName: string): string => propName.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)

  const attrs = propsToShow
    .map((p) => {
      const v = exampleValueFor(p)
      // 结构化数据 prop 与非静态值用 v-bind 引用 ref 变量；纯字符串字面量用静态属性
      if (structuredValueFor(p) !== null)
        return `    :${attrNameOf(p.name)}="${p.name}"`
      return isStatic(p) && v.startsWith('\'')
        ? `    ${attrNameOf(p.name)}=${v.replace(/'/g, '"')}`
        : `    :${attrNameOf(p.name)}="${p.name}"`
    })
    .join('\n')

  // 需要声明 ref 变量的 prop（排除直接写成静态字符串字面量属性的）
  const refProps = propsToShow.filter(p => structuredValueFor(p) !== null || !(isStatic(p) && exampleValueFor(p).startsWith('\'')))
  const valueExprFor = (p: PropDef) => structuredValueFor(p) ?? exampleValueFor(p)
  const refLinesTs = refProps.map(p => `const ${p.name} = ref<${p.type}>(${valueExprFor(p)})`).join('\n')
  const refLinesJs = refProps.map(p => `const ${p.name} = ref(${valueExprFor(p)})`).join('\n')

  const model = c.models[0]
  const modelBind = model ? `\n    v-model:${model.name}="${model.name}Value"` : ''
  const modelRefTs = model ? `\nconst ${model.name}Value = ref<${model.type}>()` : ''
  const modelRefJs = model ? `\nconst ${model.name}Value = ref()` : ''

  const event = c.emits.find(e => !e.name.startsWith('update:'))
  const eventPascalName = event
    ? event.name
        .split(/[^a-z0-9]+/i)
        .filter(Boolean)
        .map(part => part[0].toUpperCase() + part.slice(1))
        .join('')
    : ''
  const eventHandlerName = event ? `handle${eventPascalName}` : ''
  const eventPayloadName = event?.name === 'select' ? 'row' : 'payload'
  const eventPayloadType = event?.payloadType || 'unknown'
  const eventPayloadTypeRefs = event
    ? Array.from(eventPayloadType.matchAll(/\b[A-Z]\w*\b/g))
        .map(m => m[0])
        .filter(name => typeDefByName.has(name))
    : []
  const eventRefName = event?.name === 'select' ? 'selectedRow' : 'lastEventPayload'
  const eventBind = event ? `\n    @${event.name}="${eventHandlerName}"` : ''
  const eventRefTs = event ? `\nconst ${eventRefName} = ref<${eventPayloadType} | null>(null)` : ''
  const eventRefJs = event ? `\nconst ${eventRefName} = ref(null)` : ''
  const eventHandlerTs = event
    ? `\nfunction ${eventHandlerName}(${eventPayloadName}: ${eventPayloadType}): void {\n  ${eventRefName}.value = ${eventPayloadName}\n}`
    : ''
  const eventHandlerJs = event
    ? `\nfunction ${eventHandlerName}(${eventPayloadName}) {\n  ${eventRefName}.value = ${eventPayloadName}\n}`
    : ''

  const typeImports = Array.from(new Set([
    ...refProps.flatMap(p => p.typeRefs),
    ...eventPayloadTypeRefs,
  ]))
  const typeImportLine = typeImports.length
    ? `\nimport type { ${typeImports.join(', ')} } from '${c.packageName}'`
    : ''

  const dynamicSlot = dynamicSlotName
    ? `
    <template #${dynamicSlotName}="{ row }">
      <span style="color: red;">${dynamicSlotName === 'price' ? '¥' : ''}{{ row.${dynamicSlotName} }}</span>
    </template>`
    : ''

  const template = dynamicSlot
    ? `

<template>
  <${c.name}
${attrs}${eventBind}${modelBind}
  >${dynamicSlot}
  </${c.name}>
</template>`
    : `

<template>
  <${c.name}
${attrs}${eventBind}${modelBind}
  />
</template>`

  const ts = `<script setup lang="ts">
import { ref } from 'vue'
import { ${c.name} } from '${c.packageName}'${typeImportLine}
${refLinesTs}${eventRefTs}${modelRefTs}${eventHandlerTs}
</script>${template}`

  const js = `<script setup>
import { ref } from 'vue'
import { ${c.name} } from '${c.packageName}'
${refLinesJs}${eventRefJs}${modelRefJs}${eventHandlerJs}
</script>${template}`

  return { ts, js }
}

/**
 * 生成带类型提示的 TS SFC 使用示例骨架（确定性）。
 * 保留此函数做向后兼容（既有 indexer/检索链路按单一 TS 串存储）；新链路应优先用 renderExample 取双码。
 */
export function renderExampleSkeleton(c: ComponentContract): string {
  return renderExample(c).ts
}
