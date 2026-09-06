# 技术设计

## 状态模型

`AddonContext` 增加 feature 状态查询，由 `getAddonsConfig` 在完成 inspection 后创建带状态的上下文。依赖查询仍保留，用于动态模块校验与可选增强；跨 addon 默认配置使用 `isFeatureEnabled`。

为避免在 inspection 阶段引入副作用，context 使用不可变的 `featureStates` 映射，`inspectViteFeatures` 返回报告但不创建插件。

## Vitest 边界

`vitestFeature` 保留在 registry 以支持显式 `vitest: true`，但其 `triggers` 置为空，使依赖检测不会自动启用。这样显式关闭和显式开启语义保持不变。

## 兼容性

公开函数签名、addon helper、exports 与 tsup entry 不变。只新增内部 context 能力和运行时测试；已有显式 addon 配置行为保持不变。

## 风险控制

跨 addon 默认值若在独立 `inspectViteFeatures` 调用中无法获得状态，则回退为依赖判断；实际配置生成路径始终注入 inspection 状态。测试覆盖显式关闭与显式开启组合。
