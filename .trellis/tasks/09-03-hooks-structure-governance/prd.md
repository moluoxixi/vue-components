# Hooks 包结构治理

## 目标

治理 hooks 包的响应式组合逻辑与纯工具边界。

## 需求

- 清零 manifest 中归属本任务的目录职责债务。
- 仅保留真正拥有 Vue 响应式状态、监听器或生命周期的 composable。
- 将纯解析、转换和算法迁移到 services 或 utils，并保持公开 API 不变。

## 验收标准

- [ ] 对应 architecture debt 全部删除且没有新增诊断。
- [ ] 包级 test、typecheck、build 与全仓 architecture tests 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
