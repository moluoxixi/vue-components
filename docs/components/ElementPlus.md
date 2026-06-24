# Element Plus 消费约束

## 适用范围

适用于本仓库消费 Element Plus 的场景，包括：

- `packages/components` 中的基础组件封装与 request 组件。
- `packages/ConfigForm/element` 的 Element 版 ConfigForm。
- `packages/ConfigForm/plugin-element-plus` 的运行时适配插件。
- `playgrounds/components-playground` 和 `packages/ConfigForm/playground` 的 Element 示例。

## 版本与来源

| 来源 | 证据 |
|---|---|
| workspace catalog | `pnpm-workspace.yaml` 中 `element-plus: ^2.9.1` |
| lockfile | `pnpm-lock.yaml` 当前解析到 `element-plus@2.13.7` |
| components peer | `packages/components/package.json` 中 `element-plus: ^2.9.0` |

## 使用约束

- 发布包必须把 `element-plus` 作为外部 peer，不把 Element Plus 打进组件库产物。
- `packages/components` 中模板使用的 `El*` 组件要求宿主应用安装 Element Plus 插件、全局注册组件，或使用等价的自动导入方案。
- request 组件只负责把接口结果绑定到 Element Plus 组件的标准数据属性：`ElSelectV2.options`、`ElCascader.options`、`ElTreeSelect.data`。
- 表格类组件使用 Element Plus 虚拟表格与分页组件：`ElTableV2`、`ElPagination`；`ConfigTable` 已迁移到 TableV2 语义。
- playground 可以使用 `unplugin-vue-components` 的 `ElementPlusResolver` 自动导入 Element Plus 组件；库源码不依赖 playground 的自动导入配置。

## 相关文档

- 对外组件契约见 `docs/out-components/ConfigTable.md`、`docs/out-components/PopoverTableSelect.md`、`docs/out-components/RequestSelectV2.md`、`docs/out-components/RequestCascader.md`、`docs/out-components/RequestTreeSelect.md`。
- Element 版 ConfigForm 对外契约见 `docs/out-components/ElementConfigForm.md`。
