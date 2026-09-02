# Moluoxixi Components

基于 Vue 3 的组件集合，Monorepo 结构。

在线入口：

- [组件文档](https://moluoxixi.github.io/vue-components/)
- [ConfigForm 可视化设计器](https://moluoxixi.github.io/vue-components/config-form-playground/designer.html)

ConfigForm 只保留 `packages/ConfigForm/` 下的一套当前实现：`@moluoxixi/config-form` 从根入口提供 Runtime 与 Renderer，Element Plus、Ant Design Vue、Headless、Designer、Compiler 和 Workbench 分别由专用包负责。`@moluoxixi/components` 不再转发或重复包装 ConfigForm。包职责、依赖方向和扩展边界以 [ConfigForm 架构文档](./packages/ConfigForm/README.md) 为准。

## 包

| 包                                                                                             | 说明                                                        |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`@moluoxixi/components`](./packages/components/)                                              | 通用组件集合入口及 `/auto-loaders` 自动导入预设             |
| [`@moluoxixi/config-form`](./packages/ConfigForm/runtime/)                                     | Runtime/Plugin 配置表单与 Vue DOM Renderer 的唯一根入口     |
| [`@moluoxixi/config-form-headless`](./packages/ConfigForm/headless/)                           | Vue headless 字段协议、Zod 校验、readonly 与表单 controller |
| [`@moluoxixi/config-form-core`](./packages/ConfigForm/core/)                                   | 可独立复用的 JSON、条件与 reaction 纯协议/执行器            |
| [`@moluoxixi/config-form-element`](./packages/ConfigForm/element/)                             | Element Plus 轻量 ConfigForm                                |
| [`@moluoxixi/config-form-antd-vue`](./packages/ConfigForm/antd/)                               | Ant Design Vue 轻量 ConfigForm                              |
| [`@moluoxixi/config-form-devtools-vite-plugin`](./packages/ConfigForm/devtools-vite-plugin/)   | 开发态源码定位 Vite 插件                                    |
| [`@moluoxixi/config-form-designer`](./packages/ConfigForm/designer/)                           | UI 框架无关的可视化设计器文档、注册器、诊断、编译器与界面   |
| [`@moluoxixi/config-form-designer-element-plus`](./packages/ConfigForm/designer-element-plus/) | Element Plus 可视化设计器适配                               |
| [`@moluoxixi/config-form-designer-antd-vue`](./packages/ConfigForm/designer-antd-vue/)         | Ant Design Vue 可视化设计器适配                             |
| [`@moluoxixi/config-form-plugin-antd-vue`](./packages/ConfigForm/plugin-antd-vue/)             | Ant Design Vue runtime adapter                              |
| [`@moluoxixi/config-form-plugin-element-plus`](./packages/ConfigForm/plugin-element-plus/)     | Element Plus runtime adapter                                |
| [`components-playground`](./playgrounds/components-playground/)                                | `@moluoxixi/components` 包组件示例                          |
| [`config-form-playground`](./packages/ConfigForm/playground/)                                  | Element Plus、Ant Design Vue 与可视化设计器示例和交互测试   |

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

<!-- AIRULES:TRELLIS:START -->

## Trellis 工作流

本项目使用 Trellis 管理 AI 辅助开发流程。在本项目中使用 AI 编程助手时，可以直接发送以下提示词：

```text
请使用 Trellis 开始处理这个需求：<描述需求>
请使用 Trellis 继续当前任务。
请使用 Trellis 检查当前改动。
请使用 Trellis 完成本次工作。
```

AI 编程助手会根据当前宿主选择可用的命令或技能。项目的工作流、任务和规范状态位于 `.trellis/`。

将接口文档、业务说明等文本资料放入 `.trellis/knowledge/sources/`。AI 会在每次对话时检查内容差异，把资料按业务域和稳定实体整理到 `.trellis/knowledge/library/`，并更新 `.trellis/knowledge/index.md`；只有遇到会实质影响整理结果的歧义时才会询问。

<!-- AIRULES:TRELLIS:END -->
