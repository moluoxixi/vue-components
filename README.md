# Moluoxixi Components

基于 Vue 3 的组件集合，Monorepo 结构。

仓库保留两条配置表单路径：`@moluoxixi/config-form` 根入口是面向 schema、低代码和 UI plugin 的 Runtime/Plugin 实现；Element 与 Antd 两个轻量 UI 包共享 Vue headless 内核，并通过 `@moluoxixi/config-form/renderer` 生成 DOM。Headless 统一处理字段协议、required/Zod/validator、readonly、submit/reset 和校验状态，轻量 UI 包只保留真实组件绑定与样式。

## 包

| 包                                                                                             | 说明                                                                                |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`@moluoxixi/components`](./packages/components/)                                              | 组件集合入口，内置 Element/Antd ConfigForm、常用组件及 `/auto-loaders` 自动导入预设 |
| [`@moluoxixi/config-form`](./packages/ConfigForm/runtime/)                                     | Runtime/Plugin 配置表单，并通过 `/renderer` 提供轻量 Vue DOM renderer               |
| [`@moluoxixi/config-form-headless`](./packages/ConfigForm/headless/)                           | Vue headless 字段协议、Zod 校验、readonly 与表单 controller                         |
| [`@moluoxixi/config-form-core`](./packages/ConfigForm/core/)                                   | 可独立复用的 JSON、条件与 reaction 纯协议/执行器                                    |
| [`@moluoxixi/config-form-element`](./packages/ConfigForm/element/)                             | Element Plus 轻量 ConfigForm                                                        |
| [`@moluoxixi/config-form-antd-vue`](./packages/ConfigForm/antd/)                               | Ant Design Vue 轻量 ConfigForm                                                      |
| [`@moluoxixi/config-form-devtools-vite-plugin`](./packages/ConfigForm/devtools-vite-plugin/)   | 开发态源码定位 Vite 插件                                                            |
| [`@moluoxixi/config-form-designer-element-plus`](./packages/ConfigForm/designer-element-plus/) | Element Plus 可视化设计器适配                                                       |
| [`@moluoxixi/config-form-designer-antd-vue`](./packages/ConfigForm/designer-antd-vue/)         | Ant Design Vue 可视化设计器适配                                                     |
| [`@moluoxixi/config-form-plugin-antd-vue`](./packages/ConfigForm/plugin-antd-vue/)             | Ant Design Vue runtime adapter                                                      |
| [`@moluoxixi/config-form-plugin-element-plus`](./packages/ConfigForm/plugin-element-plus/)     | Element Plus runtime adapter                                                        |
| [`components-playground`](./playgrounds/components-playground/)                                | `@moluoxixi/components` 包组件示例                                                  |
| [`config-form-playground`](./packages/ConfigForm/playground/)                                  | Element Plus、Ant Design Vue 与可视化设计器示例和交互测试                           |

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
