# Moluoxixi Components

基于 Vue 3 + Zod 的组件集合，Monorepo 结构。

核心包支持 `runtime` 插件边界，可注册组件、只读展示适配器，并通过 `transformField(field)` 转换字段配置。`ConfigForm` 会统一递归处理顶层字段和 slots 内配置，渲染组件只消费处理后的字段。

## 包

| 包 | 说明 |
|---|---|
| [`@moluoxixi/components`](./packages/components/) | 组件集合入口，当前转发 ConfigForm |
| [`@moluoxixi/config-form`](./packages/ConfigForm/) | 核心表单组件 |
| [`@moluoxixi/config-form-devtools-vite-plugin`](./packages/ConfigFormDevtoolsVitePlugin/) | 开发态源码定位 Vite 插件 |
| [`@moluoxixi/config-form-plugin-antd-vue`](./packages/ConfigFormPluginAntdVue/) | Ant Design Vue runtime 适配插件 |
| [`@moluoxixi/config-form-plugin-element-plus`](./packages/ConfigFormPluginElementPlus/) | Element Plus runtime 适配插件 |
| [`element-plus-playground`](./playgrounds/element-plus-playground/) | Element Plus 示例 |
| [`antd-vue-playground`](./playgrounds/antd-vue-playground/) | Ant Design Vue 示例 |

## 开发

```bash
# 安装依赖
pnpm install

# 启动 Element Plus playground
pnpm dev:ep

# 启动 Ant Design Vue playground
pnpm dev:antd

# 构建核心包
pnpm build

# 运行测试
pnpm test

# 类型检查（含 defineField 推导测试）
pnpm typecheck
```

## License

MIT
