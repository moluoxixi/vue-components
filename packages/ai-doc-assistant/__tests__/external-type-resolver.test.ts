/**
 * 外部 / 跨目录类型展开器单测：用真实仓库内的 PopoverTableSelect 类型源文件，
 * 验证三类来源能否正确展开字段——
 *  1. 同包跨目录（ScheduleOptions，经 utils 桶文件 re-export）
 *  2. 外部库 element-plus（PopoverProps / InputProps，real interface，深度 1）
 *  3. 无法定位的名字 → 占位（fields 空 + 原因），不抛错、不伪造字段
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveExternalTypeDefs } from '../src/core/external-type-resolver'

const REPO = resolve(__dirname, '../../..')
const TYPES_FILE = resolve(
  REPO,
  'packages/components/src/PopoverTableSelect/src/types/props.ts',
)

describe('resolveExternalTypeDefs', () => {
  it('同包跨目录：经桶文件 re-export 展开 ScheduleOptions 字段', () => {
    const defs = resolveExternalTypeDefs([TYPES_FILE], ['ScheduleOptions'])
    const sched = defs.find(d => d.name === 'ScheduleOptions')
    expect(sched).toBeTruthy()
    // schedule.ts 中 ScheduleOptions 有 leading?/trailing? 字段
    const fieldNames = (sched!.fields ?? []).map(f => f.name)
    expect(fieldNames).toContain('leading')
    expect(fieldNames).toContain('trailing')
  })

  it('外部库 element-plus：展开 PopoverProps 字段并保留 @description', () => {
    const defs = resolveExternalTypeDefs([TYPES_FILE], ['PopoverProps'])
    const pp = defs.find(d => d.name === 'PopoverProps')
    expect(pp).toBeTruthy()
    expect(pp!.fields.length).toBeGreaterThan(5)
    const fieldNames = pp!.fields.map(f => f.name)
    // popover.d.ts 的 interface PopoverProps 含 placement / trigger / width 等
    expect(fieldNames).toContain('placement')
    expect(fieldNames).toContain('width')
    // 至少一个字段带 @description 文本（JSDoc 抽取生效）
    expect(pp!.fields.some(f => f.description && f.description.length > 0)).toBe(true)
  })

  it('外部库 element-plus：展开 InputProps 字段', () => {
    const defs = resolveExternalTypeDefs([TYPES_FILE], ['InputProps'])
    const ip = defs.find(d => d.name === 'InputProps')
    expect(ip).toBeTruthy()
    expect(ip!.fields.length).toBeGreaterThan(3)
  })

  it('无法定位的名字：返回占位（fields 空 + raw 标注原因），不抛错', () => {
    const defs = resolveExternalTypeDefs([TYPES_FILE], ['ThisTypeDoesNotExist'])
    const ph = defs.find(d => d.name === 'ThisTypeDoesNotExist')
    expect(ph).toBeTruthy()
    expect(ph!.fields).toHaveLength(0)
    expect(ph!.raw).toContain('未能展开')
  })

  it('相对导入省略扩展名时可解析 .d.ts 文件', () => {
    const root = join(tmpdir(), `ai-doc-ext-${Date.now()}`)
    mkdirSync(root, { recursive: true })
    const source = join(root, 'props.ts')
    const target = join(root, 'shared.d.ts')
    writeFileSync(source, 'import type { SharedProps } from \'./shared\'\nexport interface Local { shared: SharedProps }\n')
    writeFileSync(target, 'export interface SharedProps { title: string }\n')

    const defs = resolveExternalTypeDefs([source], ['SharedProps'])
    const shared = defs.find(d => d.name === 'SharedProps')

    expect(shared).toBeTruthy()
    expect(shared!.fields.map(f => f.name)).toContain('title')
  })

  it('幂等去重：同名只产出一次', () => {
    const defs = resolveExternalTypeDefs([TYPES_FILE], ['PopoverProps', 'PopoverProps'])
    expect(defs.filter(d => d.name === 'PopoverProps')).toHaveLength(1)
  })
})
