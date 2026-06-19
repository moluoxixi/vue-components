# unplugin-vue-components 消费约束

## 适用范围

适用于本仓库 playground 中通过 `unplugin-vue-components` 自动导入 Element Plus 组件的场景。

## 版本与来源

| 来源 | 证据 |
|---|---|
| workspace catalog | `pnpm-workspace.yaml` 中 `unplugin-vue-components: ^28.4.1` |
| lockfile | `pnpm-lock.yaml` 当前解析到 `unplugin-vue-components@28.8.0` |
| playground 配置 | `playgrounds/components-playground/vite.config.ts` 使用 `Components({ resolvers: [ElementPlusResolver()] })` |

## 使用约束

- 自动导入只作为 playground 和应用侧开发便利，不作为发布包构建前提。
- `packages/components` 的库构建必须显式声明 peer/external，不能依赖 playground 的自动导入 Resolver。
- 若新增 playground 需要自动导入 Element Plus 组件，应同时配置 `unplugin-auto-import` 与 `unplugin-vue-components` 的 `ElementPlusResolver`。

## 相关文档

- Element Plus 消费约束见 `docs/components/ElementPlus.md`。
