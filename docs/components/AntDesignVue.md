# Ant Design Vue 消费约束

## 适用范围

适用于本仓库消费 Ant Design Vue 的场景，包括：

- `packages/ConfigForm/antd` 的 Antd 版 ConfigForm。
- `playgrounds/components-playground` 和 `packages/ConfigForm/playground` 的 Antd 示例。
- `packages/components` 聚合导出 Antd ConfigForm 包。

## 版本与来源

| 来源 | 证据 |
|---|---|
| workspace catalog | `pnpm-workspace.yaml` 中 `ant-design-vue: ^4.2.6` |
| lockfile | `pnpm-lock.yaml` 当前解析到 `ant-design-vue@4.2.6` |
| components peer | `packages/components/package.json` 中 `ant-design-vue: ^4.2.0` |

## 使用约束

- 发布包必须把 `ant-design-vue` 作为外部 peer，不把 Ant Design Vue 打进组件库产物。
- Antd 版 ConfigForm 内部使用 Ant Design Vue 表单、栅格和字段组件时，字段绑定协议以 `packages/ConfigForm/antd` 的 adapter 与类型为准。
- playground 示例可以直接导入 Ant Design Vue 组件与样式；库源码不依赖 playground 的运行时环境。

## 相关文档

- Antd 版 ConfigForm 对外契约见 `docs/out-components/AntdConfigForm.md`。
