# 技术设计

## 边界

本阶段只处理 Designer 内部通用 JSON 工具和架构/行为测试。Designer 继续通过稳定的 Runtime Renderer/Host 合同渲染真实组件，不在本阶段移除该产品必需依赖。

## 方案

1. 在已有无 UI 依赖的 Core JSON 工具中提供统一的深拷贝入口，Designer 的 graph 与 material 工具通过包公开入口使用它。
2. 增加生产源码依赖扫描测试，允许 Designer 依赖 Runtime 根入口，拒绝 `runtime/src`、私有组件目录和未声明的 adapter 实现路径。
3. 复用现有 headless/designer 测试夹具，增加一条从 material defaultValue 到 preview model 的一致性测试，验证 clone、reaction projection 和字段默认值不共享引用。

## 兼容性

不改变任何持久化字段、命令结构、公开类型或组件事件。测试失败时应优先修复边界违规，而不是增加兼容别名或迁移分支。

## 明确不做

- 不重写 Headless Controller。
- 不合并 Schema Runtime 与 Renderer 两条公开路径。
- 不把 Designer 改造成独立渲染器，也不修改 Runtime Host 协议。
