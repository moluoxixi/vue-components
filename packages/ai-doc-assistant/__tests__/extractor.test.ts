// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { extractContract } from '../src/core/extractor'

/**
 * Extractor 测试：以临时 SFC 文件为真实输入，验证契约提取与边界兜底。
 * 用真实 vue-docgen-api 解析（不 mock），确保字段口径与上游一致。
 */
describe('extractContract', () => {
  let dir: string

  const sfc = `<script setup lang="ts">
/** 一个测试按钮 */
defineProps<{
  /** 按钮类型 */
  type?: string
  /** 是否禁用 */
  disabled?: boolean
}>()
defineEmits<{
  /** 点击 */
  (e: 'click', evt: MouseEvent): void
}>()
</script>
<template>
  <button><slot /></button>
</template>`

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ai-doc-ext-'))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('从 SFC 提取 props/emits 并保留描述', async () => {
    const file = join(dir, 'MyButton.vue')
    await writeFile(file, sfc, 'utf8')

    const contract = await extractContract(file, '@test/pkg')

    expect(contract.name).toBe('MyButton')
    expect(contract.packageName).toBe('@test/pkg')
    const typeProp = contract.props.find(p => p.name === 'type')
    expect(typeProp).toBeTruthy()
    expect(typeProp!.required).toBe(false)
    expect(typeProp!.description).toContain('按钮类型')
    const disabledProp = contract.props.find(p => p.name === 'disabled')
    expect(disabledProp).toBeTruthy()
    expect(disabledProp!.description).toContain('是否禁用')
    const clickEmit = contract.emits.find(e => e.name === 'click')
    expect(clickEmit).toBeTruthy()
    expect(clickEmit!.description).toContain('点击')
  })

  it('从 Slots 契约接口派生插槽并保留注释描述', async () => {
    const file = join(dir, 'SlotPanel.vue')
    await writeFile(file, `<script setup lang="ts">
export interface SlotPanelSlots {
  /** 标题区域 */
  header?: { title: string }
  /** 默认内容 */
  default?: { active: boolean }
}
</script>
<template>
  <slot name="header" />
  <slot />
</template>`, 'utf8')

    const contract = await extractContract(file, '@test/pkg')

    expect(contract.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'header', description: expect.stringContaining('标题区域') }),
        expect.objectContaining({ name: 'default', description: expect.stringContaining('默认内容') }),
      ]),
    )
  })

  it('文件名为 index.vue 时从目录名兜底组件名', async () => {
    const sub = join(dir, 'DatePicker')
    await mkdir(sub, { recursive: true })
    const idxFile = join(sub, 'index.vue')
    await writeFile(idxFile, sfc, 'utf8')

    const contract = await extractContract(idxFile, '@test/pkg')
    expect(contract.name).toBe('DatePicker')
  })

  it('解析失败时抛出带上下文的错误', async () => {
    await expect(extractContract(join(dir, 'nonexistent.vue'), '@test/pkg')).rejects.toThrow()
  })
})
