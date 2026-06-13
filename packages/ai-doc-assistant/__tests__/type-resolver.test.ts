// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { extractContract } from '../src/core/extractor'
import { extractDefinePropsTypeName, extractTypeRefs, parseTypeDefs } from '../src/core/type-resolver'

/**
 * 方案 A 核心回归：自定义类型字段展开。
 *
 * 复现真实组件结构：SFC 用 `defineProps<导入接口>()`，接口字段引用项目内自定义类型
 * （如 columns: ColumnDef[]）。vue-docgen 此时把 prop 类型报成退化形态（Array/unknown），
 * 必须由 type-resolver 从本地接口回填真实类型并展开关联自定义类型结构，
 * 否则模型答不出「列怎么配」。这是该 bug 的护栏测试。
 */
describe('type-resolver 纯函数', () => {
  it('extractDefinePropsTypeName 抽取 defineProps 泛型名', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-doc-dp-'))
    const f = join(dir, 'a.vue')
    await writeFile(f, `<script setup lang="ts">
import type { FooProps } from './types'
defineProps<FooProps>()
</script>`, 'utf8')
    expect(extractDefinePropsTypeName(f)).toBe('FooProps')
    await rm(dir, { recursive: true, force: true })
  })

  it('extractDefinePropsTypeName 无泛型时返回 null', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-doc-dp2-'))
    const f = join(dir, 'b.vue')
    await writeFile(f, '<script setup>\ndefineProps({ a: String })\n</script>', 'utf8')
    expect(extractDefinePropsTypeName(f)).toBeNull()
    await rm(dir, { recursive: true, force: true })
  })

  it('extractTypeRefs 剥离 []/Partial<> 取项目内自定义类型名', () => {
    expect(extractTypeRefs('ColumnDef[]')).toEqual(['ColumnDef'])
    expect(extractTypeRefs('Partial<ColumnDef>')).toEqual(['ColumnDef'])
    expect(extractTypeRefs('string | number')).toEqual([])
  })

  it('parseTypeDefs 解析 interface 字段含可选与说明', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-doc-tr-'))
    const f = join(dir, 't.ts')
    await writeFile(f, `export interface ColumnDef {
  /** 字段名 */
  field: string
  /** 列宽 */
  width?: number
}`, 'utf8')
    const defs = parseTypeDefs(f)
    const col = defs.find(d => d.name === 'ColumnDef')
    expect(col).toBeTruthy()
    expect(col!.kind).toBe('interface')
    const field = col!.fields.find(x => x.name === 'field')
    expect(field!.optional).toBe(false)
    const width = col!.fields.find(x => x.name === 'width')
    expect(width!.optional).toBe(true)
    expect(width!.description).toContain('列宽')
    await rm(dir, { recursive: true, force: true })
  })
})

describe('extractContract 自定义类型展开（方案 A 端到端）', () => {
  let root: string
  let sfcPath: string

  // 组件根：<root>/src/{index.vue, types/props.ts}
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'ai-doc-expand-'))
    const src = join(root, 'src')
    const types = join(src, 'types')
    await mkdir(types, { recursive: true })

    await writeFile(join(types, 'props.ts'), `/** 表格列定义 */
export interface MyColumn {
  /** 行字段名 */
  field: string
  /** 表头标题 */
  title: string
  /** 列宽 */
  width?: number
}

export interface MyTableProps {
  /** 列配置 */
  columns?: MyColumn[]
  /** 是否加载中 */
  loading?: boolean
}`, 'utf8')

    sfcPath = join(src, 'index.vue')
    await writeFile(sfcPath, `<script setup lang="ts">
import type { MyTableProps } from './types/props'
withDefaults(defineProps<MyTableProps>(), { columns: () => [], loading: false })
</script>
<template><div /></template>`, 'utf8')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('columns prop 回填为 MyColumn[] 并标 typeRefs', async () => {
    const c = await extractContract(sfcPath, '@test/pkg')
    const columns = c.props.find(p => p.name === 'columns')
    expect(columns).toBeTruthy()
    expect(columns!.type).toBe('MyColumn[]')
    expect(columns!.typeRefs).toContain('MyColumn')
  })

  it('typeDefs 展开 MyColumn 全部字段含说明', async () => {
    const c = await extractContract(sfcPath, '@test/pkg')
    const col = c.typeDefs.find(t => t.name === 'MyColumn')
    expect(col).toBeTruthy()
    const fieldNames = col!.fields.map(f => f.name)
    expect(fieldNames).toEqual(expect.arrayContaining(['field', 'title', 'width']))
    const width = col!.fields.find(f => f.name === 'width')
    expect(width!.optional).toBe(true)
  })

  it('只保留被引用的类型定义（可达性裁剪）', async () => {
    const c = await extractContract(sfcPath, '@test/pkg')
    // MyColumn 被 columns 引用，应保留；无关类型不应混入
    const names = c.typeDefs.map(t => t.name)
    expect(names).toContain('MyColumn')
  })
})
