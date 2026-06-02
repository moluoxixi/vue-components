# Moluoxixi Components

基于 Vue 3 的组件集合，Monorepo 结构。

核心包支持 `runtime` 插件边界，可注册组件、只读展示适配器，并通过 `transformField(field)` 转换字段配置。`ConfigForm` 会统一递归处理顶层字段和 slots 内配置，渲染组件只消费处理后的字段。

## 包

| 包 | 说明 |
|---|---|
| [`@moluoxixi/components`](./packages/components/) | 组件集合入口，聚合转发轻量 ConfigForm UI 包和常用组件 |
| [`@moluoxixi/config-form`](./packages/ConfigForm/runtime/) | 原配置化表单 runtime，负责 schema、插件、递归配置渲染和表单语义 |
| [`@moluoxixi/config-form-core`](./packages/ConfigForm/core/) | 轻量 ConfigForm UI 包共享的字段配置协议和 helper |
| [`@moluoxixi/config-form-element`](./packages/ConfigForm/element/) | Element Plus 轻量 ConfigForm |
| [`@moluoxixi/config-form-antd-vue`](./packages/ConfigForm/antd/) | Ant Design Vue 轻量 ConfigForm |
| [`@moluoxixi/config-form-shadcn-vue`](./packages/ConfigForm/shadcn/) | shadcn-vue 轻量 ConfigForm 壳 |
| [`@moluoxixi/config-form-devtools-vite-plugin`](./packages/ConfigForm/devtools-vite-plugin/) | 开发态源码定位 Vite 插件 |
| [`@moluoxixi/config-form-plugin-antd-vue`](./packages/ConfigForm/plugin-antd-vue/) | Ant Design Vue runtime 适配插件 |
| [`@moluoxixi/config-form-plugin-element-plus`](./packages/ConfigForm/plugin-element-plus/) | Element Plus runtime 适配插件 |
| [`@moluoxixi/config-form-plugin-shadcn-vue`](./packages/ConfigForm/plugin-shadcn-vue/) | shadcn-vue runtime 适配插件 |
| [`components-playground`](./playgrounds/components-playground/) | `@moluoxixi/components` 包组件示例 |
| [`config-form-playground`](./packages/ConfigForm/playground/) | 三套轻量 ConfigForm UI 包示例和交互测试 |

ConfigForm 插件包不单独提供 playground；需要接入插件时，由对应 UI 示例或业务入口自行注册插件。

## 开发

```bash
# 安装依赖
pnpm install

# 启动组件聚合 playground
pnpm dev:components

# 启动轻量 ConfigForm playground
pnpm dev:config-form

# 构建核心包
pnpm build

# 运行测试
pnpm test

# 类型检查（含 defineField 推导测试）
pnpm typecheck
```

## License

MIT
