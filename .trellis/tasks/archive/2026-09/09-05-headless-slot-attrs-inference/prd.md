# Headless 异构 Slot 类型推导修复

## 目标

修复 `defineFields<TValues>()` 在容器 slot 包含异构节点数组时将缺省 attrs 泛型推导为 `undefined` 的公共类型错误。

## 需求

- 未显式提供 `fieldAttrs`/`cellAttrs` 时继续使用 `ConfigFormAttrs` 缺省类型。
- slot 中不同 Vue 组件、字段节点与容器节点可以组合，不要求调用方补类型断言或显式 attrs 泛型。
- 保留自定义 attrs 类型的推导能力，不改变 `defineField` 的运行时行为或返回对象。

## 验收标准

- [x] Element 与 Ant adapter 的异构 slot 类型检查通过。
- [x] Headless 单测覆盖容器 slot 中混合组件节点和字段节点的类型/运行时结构。
- [x] Headless、Element、Ant 的 unit/typecheck/build 通过。
- [x] 根 typecheck 通过。

## 范围外

- 不重构 Runtime 的另一套 `defineField` API，不修改渲染行为。
