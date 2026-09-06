# Vite Config 架构改进

## 目标

改进 `@moluoxixi/vite-config` 的 addon 状态语义与 preset 边界，避免显式关闭 addon 后仍被其他 addon 推断为已启用，并避免 App/Lib 配置自动注入测试配置。

## 范围

- 将“目标项目声明了依赖”和“addon 已启用”建模为两个独立状态。
- 跨 addon 默认值只依据统一的 feature inspection 状态，不依据原始依赖是否存在。
- `vitest` 配置改为显式启用，避免 App/Lib preset 因 devDependency 自动生成 `test` 配置。
- 增加无 addon peer 的基础消费者类型与行为回归验证。

## 不在范围

- 不新增第三方 addon registry 扩展 API。
- 不改变插件同名去重策略。
- 不重写现有 addon 的业务默认值。

## 验收标准

1. 显式 `vue: false` 时，其他 addon 不再把 Vue 视为已启用；显式 `react: false` 同理。
2. 未显式设置 `vitest` 时，即使目标项目声明 `vitest`，App/Lib/Base 配置也不包含 `test` 字段；`vitest: true` 仍生成默认 Vitest 配置。
3. `inspectViteFeatures` 的结果可被 runtime 和 addon setup 复用，且不动态加载插件。
4. 现有 addon、构建、类型测试全部通过，并新增覆盖上述边界的测试。
5. 包的根入口和 addon 子入口仍保持现有导出契约。
