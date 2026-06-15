// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { extractContract } from '../src/core/extractor'
import { parseTypeDefsFromSource, resolveNamedTypeFields } from '../src/core/type-resolver'

/**
 * 回归测试：覆盖 AI 文档助手组件数据收集的四个修复点。
 * 全部以真实临时 SFC + 真实 vue-docgen 解析为输入，验证修复后的实际契约产出，
 * 不 mock 解析层，确保与上游字段口径一致。
 */
describe('extractContract — 数据收集修复回归', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ai-doc-fix-'))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('回填外置 types 目录的 prop 类型并展开可达类型定义（修复 props=unknown / typeDefs 空）', async () => {
    const root = join(dir, 'TableSelect')
    const types = join(root, 'src', 'types')
    await mkdir(types, { recursive: true })
    // 外置类型：props 接口引用列类型，列类型再引用行类型（传递闭包）
    await writeFile(join(types, 'props.ts'), `
import type { TableColumn } from './column'
/** 表格选择器属性 */
export interface TableSelectProps {
  /** 列配置 */
  columns: TableColumn[]
  /** 占位符 */
  placeholder?: string
}
`, 'utf8')
    await writeFile(join(types, 'column.ts'), `
import type { TableRow } from './row'
/** 列定义 */
export interface TableColumn {
  field: string
  title?: string
  formatter?: (row: TableRow) => string
}
`, 'utf8')
    await writeFile(join(types, 'row.ts'), `
/** 行数据 */
export interface TableRow {
  id: string
}
`, 'utf8')
    // SFC：defineProps 用导入接口（vue-docgen 会把类型报成 unknown）
    const sfc = `<script setup lang="ts">
import type { TableSelectProps } from './types/props'
defineProps<TableSelectProps>()
</script>
<template><div><slot /></div></template>`
    await writeFile(join(root, 'src', 'index.vue'), sfc, 'utf8')

    const c = await extractContract(join(root, 'src', 'index.vue'), '@test/pkg')

    expect(c.name).toBe('TableSelect')
    const columns = c.props.find(p => p.name === 'columns')
    expect(columns).toBeTruthy()
    // 关键：类型不再是 unknown，保留元素类型
    expect(columns!.type).toContain('TableColumn')
    // 传递闭包：引用到的本地类型全部纳入，含间接引用的 TableRow
    const defNames = c.typeDefs.map(t => t.name)
    expect(defNames).toContain('TableColumn')
    expect(defNames).toContain('TableRow')
  })

  it('解析 SFC 内联别名（Omit 工具类型）到底层 interface 字段（修复内联 RuntimeProps 别名）', () => {
    // 直接单元测试别名解析能力：这是「withDefaults(defineProps<RuntimeProps>())」
    // 场景下补全 prop 类型的核心逻辑。不走 vue-docgen 端到端，因为后者在无 tsconfig
    // 的临时目录里对 defineProps<Omit<...>>() 返回空 props（与本修复无关的环境行为）。
    const externalProps = `
export interface FullProps {
  /** 输入值 */
  inputValue: string
  /** 尺寸 */
  size: 'small' | 'large'
}
`
    const inlineAlias = `
type RuntimeProps = Omit<FullProps, 'inputValue'>
`
    const defs = [
      ...parseTypeDefsFromSource(externalProps, 'props.ts'),
      ...parseTypeDefsFromSource(inlineAlias, 'inline.ts'),
    ]
    const byName = new Map(defs.map(d => [d.name, d]))

    // RuntimeProps 别名本身无直接字段，需跟随 Omit 解析到 FullProps
    const fields = resolveNamedTypeFields('RuntimeProps', byName)
    const fieldNames = fields.map(f => f.name)
    // Omit 后保留 size，剔除 inputValue
    expect(fieldNames).toContain('size')
    expect(fieldNames).not.toContain('inputValue')
    const size = fields.find(f => f.name === 'size')
    expect(size!.type).toContain('small')
  })

  it('从 <Comp>Slots 契约派生插槽，含索引签名动态插槽（修复伪插槽 name / 空插槽）', async () => {
    const root = join(dir, 'SlotComp')
    const types = join(root, 'src', 'types')
    await mkdir(types, { recursive: true })
    await writeFile(join(types, 'slots.ts'), `
export interface SlotCompSlots {
  /** 默认内容 */
  default: () => any
  /** 按列名动态声明的单元格插槽 */
  [name: string]: (scope: { row: any }) => any
}
`, 'utf8')
    // 模板用动态插槽转发，vue-docgen 会误报伪插槽 name
    const sfc = `<script setup lang="ts">
const cols = ['a', 'b']
</script>
<template>
  <div>
    <slot />
    <template v-for="name in cols" #[name]="scope"><slot :name="name" v-bind="scope" /></template>
  </div>
</template>`
    await writeFile(join(root, 'src', 'index.vue'), sfc, 'utf8')

    const c = await extractContract(join(root, 'src', 'index.vue'), '@test/pkg')
    const slotNames = c.slots.map(s => s.name)
    // 真实具名插槽
    expect(slotNames).toContain('default')
    // 索引签名 → 动态插槽说明
    expect(slotNames).toContain('[dynamic]')
    // 不再出现 vue-docgen 误判的伪插槽 name
    expect(slotNames).not.toContain('name')
  })

  it('合并 v-bind="$attrs" 透传的内部子组件 props（修复 columns 丢失 / base 幽灵组件）', async () => {
    const root = join(dir, 'ForwardComp')
    const base = join(root, 'src', 'base')
    const types = join(root, 'src', 'types')
    await mkdir(base, { recursive: true })
    await mkdir(types, { recursive: true })
    // 子组件 base：声明核心 props columns
    await writeFile(join(types, 'baseProps.ts'), `
export interface BaseProps {
  /** 列配置 */
  columns: string[]
}
`, 'utf8')
    await writeFile(join(base, 'index.vue'), `<script setup lang="ts">
import type { BaseProps } from '../types/baseProps'
defineProps<BaseProps>()
</script>
<template><table /></template>`, 'utf8')
    // 父组件：仅声明自身 props，通过 v-bind="$attrs" 转发给 base
    const parent = `<script setup lang="ts">
import Base from './base/index.vue'
defineProps<{ placeholder?: string }>()
</script>
<template><Base v-bind="$attrs" /></template>`
    await writeFile(join(root, 'src', 'index.vue'), parent, 'utf8')

    const c = await extractContract(join(root, 'src', 'index.vue'), '@test/pkg')
    // 父组件名取目录名，不是 base
    expect(c.name).toBe('ForwardComp')
    const names = c.props.map(p => p.name)
    // 父自身 prop + 透传子组件 prop 都在
    expect(names).toContain('placeholder')
    expect(names).toContain('columns')
  })

  it('无 $attrs 透传时不合并子组件 props（合并仅在确有转发语义时触发）', async () => {
    const root = join(dir, 'NoForward')
    const base = join(root, 'src', 'base')
    await mkdir(base, { recursive: true })
    await writeFile(join(base, 'index.vue'), `<script setup lang="ts">
defineProps<{ secret: string }>()
</script>
<template><div /></template>`, 'utf8')
    const parent = `<script setup lang="ts">
import Base from './base/index.vue'
defineProps<{ visible?: boolean }>()
</script>
<template><Base /></template>`
    await writeFile(join(root, 'src', 'index.vue'), parent, 'utf8')

    const c = await extractContract(join(root, 'src', 'index.vue'), '@test/pkg')
    const names = c.props.map(p => p.name)
    expect(names).toContain('visible')
    expect(names).not.toContain('secret')
  })

  it('交叉类型多次引用同一基接口时不漏字段（防 seen 跨兄弟分支共享）', () => {
    // Pick<Base,'a'> & Pick<Base,'b'>：两个分支都引用 Base，
    // 若防环 seen 在兄弟分支间共享，第二个 Pick 会拿到空字段导致 b 漏收。
    const base = `
export interface Base {
  a: string
  b: number
  c: boolean
}
`
    const alias = `
type Mixed = Pick<Base, 'a'> & Pick<Base, 'b'>
`
    const defs = [
      ...parseTypeDefsFromSource(base, 'base.ts'),
      ...parseTypeDefsFromSource(alias, 'alias.ts'),
    ]
    const byName = new Map(defs.map(d => [d.name, d]))
    const fieldNames = resolveNamedTypeFields('Mixed', byName).map(f => f.name).sort()
    // 两个分支的字段都要保留
    expect(fieldNames).toEqual(['a', 'b'])
  })

  it('交叉类型合并两个基接口的全部字段', () => {
    const src = `
export interface SizeProps { size: 'sm' | 'lg' }
export interface ColorProps { color: string }
type Merged = SizeProps & ColorProps
`
    const defs = parseTypeDefsFromSource(src, 'merged.ts')
    const byName = new Map(defs.map(d => [d.name, d]))
    const fieldNames = resolveNamedTypeFields('Merged', byName).map(f => f.name).sort()
    expect(fieldNames).toEqual(['color', 'size'])
  })

  it('真递归别名不死循环并返回空（A=B; B=A）', () => {
    const src = `
type A = B
type B = A
`
    const defs = parseTypeDefsFromSource(src, 'cycle.ts')
    const byName = new Map(defs.map(d => [d.name, d]))
    // 不抛错、不挂死，返回空字段集
    expect(resolveNamedTypeFields('A', byName)).toEqual([])
  })

  it('type-alias 形式的对象字面量也捕获索引签名（对齐 interface 口径）', () => {
    // type XxxSlots = { default: ...; [k:string]: ... }
    const src = `
type CompSlots = {
  default: () => any
  [col: string]: (scope: { row: any }) => any
}
`
    const defs = parseTypeDefsFromSource(src, 'slots.ts')
    const byName = new Map(defs.map(d => [d.name, d]))
    const fieldNames = resolveNamedTypeFields('CompSlots', byName).map(f => f.name)
    expect(fieldNames).toContain('default')
    // 索引签名字段名形如 [col: string]
    expect(fieldNames.some(n => n.startsWith('['))).toBe(true)
  })

  it('父 import 多个子组件时只合并真正接收 $attrs 的那个（合并精度）', async () => {
    const root = join(dir, 'MultiChild')
    const a = join(root, 'src', 'a')
    const b = join(root, 'src', 'b')
    await mkdir(a, { recursive: true })
    await mkdir(b, { recursive: true })
    // 子组件 A 接收 $attrs，暴露 forwarded prop
    await writeFile(join(a, 'index.vue'), `<script setup lang="ts">
defineProps<{ forwarded: string }>()
</script>
<template><div /></template>`, 'utf8')
    // 子组件 B 不接收 $attrs，其 prop 不应并入父
    await writeFile(join(b, 'index.vue'), `<script setup lang="ts">
defineProps<{ leaked: string }>()
</script>
<template><div /></template>`, 'utf8')
    const parent = `<script setup lang="ts">
import A from './a/index.vue'
import B from './b/index.vue'
defineProps<{ own?: boolean }>()
</script>
<template><div><A v-bind="$attrs" /><B /></div></template>`
    await writeFile(join(root, 'src', 'index.vue'), parent, 'utf8')

    const c = await extractContract(join(root, 'src', 'index.vue'), '@test/pkg')
    const names = c.props.map(p => p.name)
    expect(names).toContain('own')
    expect(names).toContain('forwarded')
    // B 未接收 $attrs，其 prop 不得泄漏到父契约
    expect(names).not.toContain('leaked')
  })
})
