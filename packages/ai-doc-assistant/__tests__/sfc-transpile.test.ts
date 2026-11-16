/**
 * SFC TS→JS 转译单测：验证从 `<script setup lang="ts">` 确定性产出 JS 版，
 * 保证双码语义一致、template 原样保留、无 ts script 时不伪造降级（返回 undefined）。
 */
import { describe, expect, it } from 'vitest'
import { transpileSfcToJs } from '../src/core/sfc-transpile'

describe('transpileSfcToJs', () => {
  it('剥离 lang="ts"、类型注解、import type 并保留 template', () => {
    const ts = [
      '<script setup lang="ts">',
      'import { ref } from \'vue\'',
      'import { PopoverTableSelect } from \'@moluoxixi/components\'',
      'import type { PopoverTableColumn } from \'@moluoxixi/components\'',
      'const columns: PopoverTableColumn[] = [{ field: \'name\' }]',
      'const kw = ref<string>(\'\')',
      '</script>',
      '',
      '<template>',
      '  <PopoverTableSelect :columns="columns" v-model="kw" />',
      '</template>',
    ].join('\n')
    const js = transpileSfcToJs(ts)
    expect(js).toBeTypeOf('string')
    const out = js as string
    // lang="ts" 去掉
    expect(out).toContain('<script setup>')
    expect(out).not.toContain('lang="ts"')
    // import type 整行剥离
    expect(out).not.toContain('import type')
    expect(out).not.toContain('PopoverTableColumn')
    // 类型注解 / 泛型剥离
    expect(out).not.toContain(': PopoverTableColumn[]')
    expect(out).not.toContain('ref<string>')
    expect(out).toContain('ref(\'\')')
    // 运行时 import 保留
    expect(out).toContain('import { ref }')
    expect(out).toContain('PopoverTableSelect')
    // template 原样保留
    expect(out).toContain('<template>')
    expect(out).toContain('v-model="kw"')
  })

  it('保留仅在 template 使用、script 未引用的组件 import（transpileModule 不得当死代码删除）', () => {
    // 回归 bug：transpileModule 只看 <script>、看不到 <template>，
    // 默认会把 script 里“看似未使用”的 value import（组件名只在模板用）当死代码删除，
    // 导致 JS 版丢失组件导入、复制出去跑不起来。verbatimModuleSyntax 必须保住它。
    const ts = [
      '<script setup lang="ts">',
      'import { PopoverTableSelect } from \'@moluoxixi/components\'',
      'import type { PopoverTableColumn } from \'@moluoxixi/components\'',
      'const columns: PopoverTableColumn[] = [{ field: \'name\' }]',
      '</script>',
      '',
      '<template>',
      '  <PopoverTableSelect :columns="columns" />',
      '</template>',
    ].join('\n')
    const js = transpileSfcToJs(ts) as string
    expect(js).toBeTypeOf('string')
    // 组件 value import 必须保留（即便 script 体内未直接引用）
    expect(js).toContain('import { PopoverTableSelect }')
    // type import 仍须剥离
    expect(js).not.toContain('import type')
    expect(js).not.toContain('PopoverTableColumn')
  })

  it('无 lang="ts" script（已是 JS）时返回 undefined，不伪造转译', () => {
    const sfc = [
      '<script setup>',
      'import { ref } from \'vue\'',
      'const a = ref(0)',
      '</script>',
      '<template><div>{{ a }}</div></template>',
    ].join('\n')
    expect(transpileSfcToJs(sfc)).toBeUndefined()
  })

  it('无 script 块时返回 undefined', () => {
    expect(transpileSfcToJs('<template><div>纯模板</div></template>')).toBeUndefined()
  })

  it('script 语法错误时返回 undefined，不产出不可运行 JS', () => {
    const broken = [
      '<script setup lang="ts">',
      'const columns = [',
      '  { field: \'name\', title商品名称\', width: 150 },',
      ']',
      '</script>',
      '<template><div /></template>',
    ].join('\n')
    expect(transpileSfcToJs(broken)).toBeUndefined()
  })

  it('转译后内容与 TS 版有差异（确实做了剥离）才返回，否则 undefined', () => {
    // script setup lang=ts 但 body 无任何类型 → 转译后除 lang 外无实质差异，
    // 仍应返回（lang 已变），用于驱动 JS 预览。
    const ts = [
      '<script setup lang="ts">',
      'import { ref } from \'vue\'',
      'const n = ref(0)',
      '</script>',
      '<template><div>{{ n }}</div></template>',
    ].join('\n')
    const js = transpileSfcToJs(ts)
    expect(js).toBeTypeOf('string')
    expect(js as string).toContain('<script setup>')
  })
})
