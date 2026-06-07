# 外部组件库消费文档索引

记录当前仓库消费外部组件库、Design System、UI SDK 或组件自动导入工具的约束。当前仓库自身组件库的提供方契约维护在 [docs/out-components](../out-components/index.md)。

## 来源证据

| 字段 | 值 |
|---|---|
| generatedBy | `components-docs` consumer mode |
| dependencySources | `pnpm-workspace.yaml`、`packages/*/package.json`、`packages/ConfigForm/*/package.json`、`playgrounds/*/package.json`、`pnpm-lock.yaml` |
| importSources | `packages/ConfigForm/*/src`、`packages/components/src`、`packages/ConfigForm/playground/src`、`playgrounds/components-playground/src`、两个 playground 的 `vite.config.ts` |

## 组件库清单

| 组件库/工具 | 文档 | 本仓库用途 | 状态 |
|---|---|---|---|
| Ant Design Vue | [AntDesignVue](AntDesignVue.md) | Antd 版 ConfigForm、运行时适配插件和 playground 示例 | 已确认 |
| Element Plus | [ElementPlus](ElementPlus.md) | Element 版 ConfigForm、基础组件封装、自动导入 Resolver 和 playground 示例 | 已确认 |
| shadcn-vue 本地组件协议 | [ShadcnVue](ShadcnVue.md) | 本地生成组件注册、字段绑定和只读展示适配 | 已确认，未发现直接 package 依赖 |
| unplugin-vue-components | [UnpluginVueComponents](UnpluginVueComponents.md) | playground 自动导入 Element Plus 组件 | 已确认 |
