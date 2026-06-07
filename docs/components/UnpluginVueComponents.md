# unplugin-vue-components消费约束

## 用途

`unplugin-vue-components` 仅用于两个 playground 自动导入 Element Plus 组件，配合 `ElementPlusResolver()` 降低示例代码的局部导入噪声。当前 catalog 版本范围为 `^28.4.1`，lockfile 解析版本为 `28.8.0`。

## 来源

| 类型 | 路径 |
|---|---|
| package | `packages/ConfigForm/playground/package.json`、`playgrounds/components-playground/package.json` |
| 配置 | `packages/ConfigForm/playground/vite.config.ts`、`playgrounds/components-playground/vite.config.ts` |

## 使用约束

- 只在 playground Vite 配置中启用，不作为组件库生产包的公共契约。
- 当前配置为 `Components({ dts: false, resolvers: [ElementPlusResolver()] })`，不会生成组件自动导入类型声明。
- 自动导入范围只覆盖 Element Plus Resolver；Ant Design Vue 示例仍采用显式 import。
- 修改 Resolver 或开启 `dts` 时，需要同步检查 playground typecheck 和示例源码导入方式。

## 交互状态

该工具不提供 UI 交互，只影响示例构建阶段的组件解析。

## 可访问性

N/A；可访问性由被导入的实际组件和示例代码承担。

## 测试建议

修改自动导入配置后运行两个 playground 的 `typecheck` 与构建；涉及用户路径时补充对应 Playwright 示例验证。

## 缺口

MISSING 生产包级自动导入约束；当前源码证据显示自动导入只在 playground 中使用。
