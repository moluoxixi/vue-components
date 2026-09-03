# 全仓入口与组件所有权门禁技术设计

## 1. 所有权

在根 `scripts/` 下建立 package architecture 检查能力，避免把仓库级规则塞进任一业务包。配置、collector、模块解析和报告按职责拆分，根测试直接执行同一生产检查入口。

## 2. 数据合同

```ts
interface PackageArchitectureManifest {
  version: 1
  pathExceptions: Array<{
    path: string
    kind: 'generated' | 'third-party'
    reason: string
  }>
  packageExceptions: Array<{
    package: string
    kind: 'framework' | 'cli' | 'private-app'
    rules: string[]
    reason: string
  }>
  componentExceptions: Array<{
    component: string
    kind: 'public' | 'dynamic' | 'framework'
    rules: string[]
    owners: string[]
    reason: string
  }>
  debt: Array<{
    path: string
    rule: string
    targetTask: string
    reason: string
    owners?: string[]
  }>
}
```

诊断统一为 `{ rule, path, message, owners? }`，排序使用 `rule -> path -> owners`，便于稳定测试和逐项删除债务。

## 3. 引用图

- 使用 TypeScript AST 解析 import/export/import()，解析相对路径与 `index.ts` barrel。
- 构建入口检查覆盖 package script 与 Vite/tsup entry，发布产物检查对齐 main/module/types 与根 export conditions。
- `.vue` 先解析 SFC script/script setup，再交给 TypeScript parser；模板自动组件只允许通过 dynamic/framework 例外进入。
- Feature identity 取 package 内最接近的显式 Feature root；父组件 ownership 使用组件目录与生产引用图共同判断。

## 4. 渐进门禁

- Collector 产出全部诊断。
- Manifest exception 消除被证明合理的 public/dynamic/framework 诊断。
- Component exception 必须按 component、rule 和静态 owners 精确匹配；动态 owner 路径也必须真实存在。
- 对 `component.owner-required` 这类无静态 owner 的诊断，manifest owner 表示可审计的 framework/dynamic 语义 owner，并通过真实路径存在性校验。
- Debt 只接受当前已存在且有 targetTask 的诊断；未知诊断失败，过期 debt 同样失败。
- `targetTask` 必须解析到 `.trellis/tasks/` 中的真实任务；仅写未来计划字符串会使 manifest 无效。
- 父任务最终验收要求 debt 数组为空。

## 5. 测试

- 以临时 fixture workspace 覆盖入口、barrel、动态 import 和组件 owner。
- 对真实仓库运行 smoke，保证 manifest 与当前诊断精确匹配。
- 不把测试实现复制成第二套 collector。
