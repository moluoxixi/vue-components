# 外部组件库消费文档索引

## 来源快照

| 字段 | 值 |
|---|---|
| sourceCommit | `f9497c29cc1e` |
| sourceState | dirty；本轮新增 Tiptap 富文本封装与 Lucide 图标依赖。 |
| generatedBy | 手工维护 |
| sourceFiles | `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`packages/components`、`packages/ConfigForm/*`、`playgrounds/*` |

## 组件库清单

| 组件库/工具 | 文档 | 本仓库用途 |
|---|---|---|
| Ant Design Vue | [AntDesignVue](AntDesignVue.md) | Antd 版 ConfigForm、运行时适配插件和 playground 示例 |
| Element Plus | [ElementPlus](ElementPlus.md) | Element 版 ConfigForm、基础组件封装、自动导入 Resolver 和 playground 示例 |
| Tiptap / Lucide | [Tiptap](Tiptap.md) | RichTextEditor 编辑内核、工具栏图标与浮层基础依赖 |
| shadcn-vue 本地组件协议 | [ShadcnVue](ShadcnVue.md) | 本地生成组件注册、字段绑定和只读展示适配 |
| unplugin-vue-components | [UnpluginVueComponents](UnpluginVueComponents.md) | playground 自动导入 Element Plus 组件 |

## 维护约定

- 当前目录只记录本仓库消费外部组件库或工具的约束，不记录本仓库对外提供的组件契约。
- 本仓库组件库对外契约维护在 `docs/out-components/`。
- 新增外部组件库、升级主版本或修改公共封装适配层时，需要同步更新本目录对应文档。
