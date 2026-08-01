# Moluoxixi Components

基于 Vue 3 的组件集合，Monorepo 结构。

仓库保留两条配置表单路径：`@moluoxixi/config-form` 是带 runtime adapter/plugin 的完整实现；Element、Antd、Shadcn 三个轻量 UI 包共享 `@moluoxixi/config-form-headless`，由 Headless 统一处理字段协议、required/Zod/validator、readonly、submit/reset 和校验状态，UI 包只负责布局、字段壳与真实组件绑定。

## 包

| 包 | 说明 |
|---|---|
| [`@moluoxixi/components`](./packages/components/) | 组件集合入口，内置独立的 Element/Antd 纯净 ConfigForm 和常用组件 |
| [`@moluoxixi/config-form`](./packages/ConfigForm/runtime/) | 原配置化表单 runtime，负责 schema、runtime adapter、递归配置渲染和表单语义 |
| [`@moluoxixi/config-form-headless`](./packages/ConfigForm/headless/) | 轻量 ConfigForm 的字段协议、Zod 校验、readonly 与表单 controller |
| [`@moluoxixi/config-form-core`](./packages/ConfigForm/core/) | headless 公共 API 的兼容入口 |
| [`@moluoxixi/config-form-element`](./packages/ConfigForm/element/) | Element Plus 轻量 ConfigForm |
| [`@moluoxixi/config-form-antd-vue`](./packages/ConfigForm/antd/) | Ant Design Vue 轻量 ConfigForm |
| [`@moluoxixi/config-form-shadcn-vue`](./packages/ConfigForm/shadcn/) | shadcn-vue 轻量 ConfigForm 壳 |
| [`@moluoxixi/config-form-devtools-vite-plugin`](./packages/ConfigForm/devtools-vite-plugin/) | 开发态源码定位 Vite 插件 |
| [`@moluoxixi/config-form-plugin-antd-vue`](./packages/ConfigForm/plugin-antd-vue/) | Ant Design Vue runtime adapter |
| [`@moluoxixi/config-form-plugin-element-plus`](./packages/ConfigForm/plugin-element-plus/) | Element Plus runtime adapter |
| [`@moluoxixi/config-form-plugin-shadcn-vue`](./packages/ConfigForm/plugin-shadcn-vue/) | shadcn-vue runtime adapter |
| [`components-playground`](./playgrounds/components-playground/) | `@moluoxixi/components` 包组件示例 |
| [`config-form-playground`](./packages/ConfigForm/playground/) | 三套轻量 ConfigForm UI 包示例和交互测试 |

ConfigForm runtime adapter 包不单独提供 playground，也不是 Vue `app.use()` 插件；需要接入 adapter 时，由对应 UI 示例或业务入口传给 `runtime.plugins`。

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
