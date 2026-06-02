# @moluoxixi/config-form-devtools-vite-plugin

ConfigForm 的 Vite 开发期调试插件。

## 使用

```ts
import { configFormDevtools } from '@moluoxixi/config-form-devtools-vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    configFormDevtools({
      packageNames: ['@moluoxixi/config-form'],
    }),
  ],
})
```

## 公开导出

- `configFormDevtools`
- `configFormDevtoolsVitePlugin`
- `ConfigFormDevtoolsPluginError`
- `ConfigFormDevtoolsHttpError`

## 选项

- `packageNames`：需要重写和检测的 ConfigForm 包名
- `allowRoots`：`open-in-editor` 允许访问的额外根目录
- `editor`：覆盖编辑器命令

## 约束

- 仅用于 `vite` 开发服务模式
- 客户端安装依赖浏览器 `document`
- `open-in-editor` 端点固定为 `/__config-form-devtools/open`
