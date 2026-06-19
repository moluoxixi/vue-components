# shadcn-vue 本地组件协议消费约束

## 适用范围

适用于 `packages/ConfigForm/shadcn`、`packages/ConfigForm/plugin-shadcn-vue` 和相关 playground 示例中的本地 shadcn 风格组件协议。

## 来源与边界

| 来源 | 证据 |
|---|---|
| 本地包 | `packages/ConfigForm/shadcn` |
| 运行时插件 | `packages/ConfigForm/plugin-shadcn-vue` |
| 示例 | `playgrounds/components-playground/src/examples/ShadcnConfigForm.vue`、`packages/ConfigForm/playground` |

## 使用约束

- 当前仓库使用的是本地 shadcn 风格组件协议，不登记为外部 npm UI 包依赖。
- 字段绑定、错误展示、只读展示和本地组件注册以 `packages/ConfigForm/shadcn` 与 `packages/ConfigForm/plugin-shadcn-vue` 的类型和测试为准。
- 不把 shadcn 本地协议写入 `docs/out-components/`；对外可复用的 ConfigForm 契约见 `docs/out-components/ShadcnConfigForm.md`。

## 相关文档

- Shadcn 版 ConfigForm 对外契约见 `docs/out-components/ShadcnConfigForm.md`。
