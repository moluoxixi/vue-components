import type { ComponentContract, PropDef } from './types'

/**
 * 把组件契约渲染为「可检索正文」：自然语言化的契约描述，作为 indexer 的 embedding 语料与 BM25 全文源。
 * 文本结构稳定、信息密度高，便于向量召回与关键词命中。
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
  const requiredProps = c.props.filter(p => p.required)
  const propsToShow = requiredProps.length ? requiredProps : c.props.slice(0, 3)

  const isStatic = (p: PropDef) => {
    const v = exampleValueFor(p)
    return v.startsWith('\'') || v === 'true' || v === 'false' || /^\d+$/.test(v)
  }

  const attrs = propsToShow
    .map((p) => {
      const v = exampleValueFor(p)
      // 字符串字面量用静态属性，其余用 v-bind 并引用 ref 变量
      return isStatic(p) && v.startsWith('\'')
        ? `    ${p.name}=${v.replace(/'/g, '"')}`
        : `    :${p.name}="${p.name}"`
    })
    .join('\n')

  // 需要声明 ref 变量的 prop（排除直接写成静态字符串字面量属性的）
  const refProps = propsToShow.filter(p => !(isStatic(p) && exampleValueFor(p).startsWith('\'')))
  const refLinesTs = refProps.map(p => `const ${p.name} = ref<${p.type}>(${exampleValueFor(p)})`).join('\n')
  const refLinesJs = refProps.map(p => `const ${p.name} = ref(${exampleValueFor(p)})`).join('\n')

  const model = c.models[0]
  const modelBind = model ? `\n    v-model:${model.name}="${model.name}Value"` : ''
  const modelRefTs = model ? `\nconst ${model.name}Value = ref<${model.type}>()` : ''
  const modelRefJs = model ? `\nconst ${model.name}Value = ref()` : ''

  const template = `

<template>
  <${c.name}
${attrs}${modelBind}
  />
</template>`

  const ts = `<script setup lang="ts">
import { ref } from 'vue'
import { ${c.name} } from '${c.packageName}'
${refLinesTs}${modelRefTs}
</script>${template}`

  const js = `<script setup>
import { ref } from 'vue'
import { ${c.name} } from '${c.packageName}'
${refLinesJs}${modelRefJs}
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
