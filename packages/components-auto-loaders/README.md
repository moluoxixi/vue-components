# @moluoxixi/components-auto-loaders

`@moluoxixi/components` 的官方自动按需加载预设，分别适配 `unplugin-vue-components` 和 `unplugin-auto-import`。

```bash
pnpm add @moluoxixi/components
pnpm add -D @moluoxixi/components-auto-loaders unplugin-auto-import unplugin-vue-components
```

```ts
import { autoComponent, autoImport } from '@moluoxixi/components-auto-loaders'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

export default {
  plugins: [
    AutoImport({ imports: [autoImport] }),
    Components({ resolvers: [autoComponent] }),
  ],
}
```

`autoComponent` 从组件子入口按需导入组件并加载共享样式。`autoImport` 按最小公共子入口导入运行时 API；TypeScript 类型仍需使用 `import type` 显式导入。
