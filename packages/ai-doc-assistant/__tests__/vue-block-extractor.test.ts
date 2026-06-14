// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { extractVueBlocks, PREVIEW_ALLOWED_MODULES, splitAnswerSegments } from '../src/core/vue-block-extractor'

const VUE_OK = '```vue\n<script setup lang="ts">\nimport { PopoverTableSelect } from \'@moluoxixi/components\'\nconst columns = [{ field: \'name\' }]\n</script>\n<template>\n  <PopoverTableSelect :columns="columns" />\n</template>\n```'
const VUE_BAD = '```vue\n<script setup lang="ts">\nimport { ElButton } from \'element-plus\'\n</script>\n<template><ElButton /></template>\n```'
const VUE_NO_DEMO = '```vue no-demo\n<script setup lang="ts">\nimport { Foo } from \'@moluoxixi/components\'\n</script>\n<template><Foo /></template>\n```'

describe('splitAnswerSegments', () => {
  it('把文字与 vue 块按序切分，可渲染块标 renderable=true', () => {
    const md = `下面是示例：\n${VUE_OK}\n以上即配置方式。`
    const segs = splitAnswerSegments(md)
    expect(segs.map(s => s.kind)).toEqual(['text', 'vue', 'text'])
    expect(segs[0]).toMatchObject({ kind: 'text', text: '下面是示例：' })
    expect(segs[1]).toMatchObject({ kind: 'vue', renderable: true })
    if (segs[1].kind === 'vue')
      expect(segs[1].source).toContain('PopoverTableSelect')
    expect(segs[2]).toMatchObject({ kind: 'text', text: '以上即配置方式。' })
  })

  it('白名单外依赖的 vue 块标 renderable=false 且带原因', () => {
    const segs = splitAnswerSegments(`需要按钮：\n${VUE_BAD}`)
    const vue = segs.find(s => s.kind === 'vue')
    expect(vue?.kind).toBe('vue')
    if (vue?.kind === 'vue') {
      expect(vue.renderable).toBe(false)
      expect(vue.reason).toContain('element-plus')
    }
  })

  it('no-demo 标识的 vue 块即使依赖合法也不可渲染', () => {
    const segs = splitAnswerSegments(VUE_NO_DEMO)
    const vue = segs.find(s => s.kind === 'vue')
    expect(vue?.kind).toBe('vue')
    if (vue?.kind === 'vue') {
      expect(vue.renderable).toBe(false)
      expect(vue.reason).toContain('no-demo')
    }
  })

  it('多个 vue 块按序全部切出', () => {
    const md = `一：\n${VUE_OK}\n二：\n${VUE_BAD}`
    const segs = splitAnswerSegments(md)
    const vues = segs.filter(s => s.kind === 'vue')
    expect(vues).toHaveLength(2)
    expect(vues[0]).toMatchObject({ renderable: true })
    expect(vues[1]).toMatchObject({ renderable: false })
  })

  it('非 vue 代码块（如 ts/bash）并入文字，保留围栏原文', () => {
    const md = '安装：\n```bash\npnpm add x\n```\n完成。'
    const segs = splitAnswerSegments(md)
    expect(segs.every(s => s.kind === 'text')).toBe(true)
    expect(segs.map(s => s.kind === 'text' ? s.text : '').join('\n')).toContain('pnpm add x')
    expect(segs.map(s => s.kind === 'text' ? s.text : '').join('\n')).toContain('```bash')
  })

  it('未闭合的 fence（流式中途）当作文字，不误切为块', () => {
    const md = '示例：\n```vue\n<script setup lang="ts">\nimport { X }'
    const segs = splitAnswerSegments(md)
    expect(segs.every(s => s.kind === 'text')).toBe(true)
  })

  it('纯文字无代码块时返回单个文字段', () => {
    const segs = splitAnswerSegments('就是一段普通说明，没有代码。')
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({ kind: 'text' })
  })

  it('空输入返回空数组', () => {
    expect(splitAnswerSegments('')).toEqual([])
    expect(splitAnswerSegments('   \n  ')).toEqual([])
  })

  it('相对路径 import 视为不可解析，标记不可渲染', () => {
    const md = '```vue\n<script setup lang="ts">\nimport Foo from \'./Foo.vue\'\n</script>\n<template><Foo /></template>\n```'
    const segs = splitAnswerSegments(md)
    const vue = segs.find(s => s.kind === 'vue')
    if (vue?.kind === 'vue') {
      expect(vue.renderable).toBe(false)
      expect(vue.reason).toContain('./Foo.vue')
    }
  })
})

describe('extractVueBlocks', () => {
  it('只返回 vue 块（剥离文字段），保留判定结果', () => {
    const md = `文字\n${VUE_OK}\n文字\n${VUE_BAD}`
    const blocks = extractVueBlocks(md)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].renderable).toBe(true)
    expect(blocks[0].source).toContain('PopoverTableSelect')
    expect(blocks[1].renderable).toBe(false)
    expect(blocks[1].reason).toContain('element-plus')
    // 不应带 kind 字段（已剥离）
    expect('kind' in blocks[0]).toBe(false)
  })

  it('无 vue 块时返回空数组', () => {
    expect(extractVueBlocks('纯文字')).toEqual([])
  })

  it('子路径依赖 @moluoxixi/components/styles 在白名单内', () => {
    const md = '```vue\n<script setup lang="ts">\nimport \'@moluoxixi/components/styles\'\nimport { Foo } from \'@moluoxixi/components\'\n</script>\n<template><Foo /></template>\n```'
    const blocks = extractVueBlocks(md)
    expect(blocks[0].renderable).toBe(true)
  })

  it('白名单常量包含 vue 与组件库', () => {
    expect(PREVIEW_ALLOWED_MODULES).toContain('vue')
    expect(PREVIEW_ALLOWED_MODULES).toContain('@moluoxixi/components')
  })
})
