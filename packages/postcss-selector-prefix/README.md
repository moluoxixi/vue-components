# @moluoxixi/postcss-selector-prefix

基于 `postcss-selector-parser` 的 PostCSS 插件，用于精确替换 class 与 id 选择器的名称前缀。
插件会替换 selector AST 中的 class/id 节点、`class`/`id` 属性选择器的值，
以及 CSS 值里能表达 selector 的文本片段；
不会改写 `url(...)` 这类资源路径，也不会碰 HTML 或 JS 字符串。

## Vite 使用

```ts
import { createSelectorPrefixPlugin } from '@moluoxixi/postcss-selector-prefix'
import { defineConfig } from 'vite'

export default defineConfig({
  css: {
    postcss: {
      plugins: [
        createSelectorPrefixPlugin({
          fromPrefix: 'el-',
          toPrefix: 'moluoxixi-',
        }),
      ],
    },
  },
})
```

以上配置会将 `.el-button`、`#el-app`、`[class^="el-"]`、`[id="el-app"]`
以及 `content: '.el-button #el-app'`、`@supports selector(.el-button)` 里的 selector
文本改写为对应的 `moluoxixi` 前缀；`url(".el-button.svg")` 仍会保持原样。
