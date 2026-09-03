# ConfigForm Runtime 与领域结构治理

## 目标

治理 Model、Compiler、Runtime、Headless 等领域和渲染边界。

## 需求

- 清零 manifest 中归属本任务的 runtime/domain 目录债务。
- 按 validation、operations、rendering、controller 等职责拆分实现。
- 保持文档协议与运行时语义，遵守 current-contract-only。

## 验收标准

- [ ] 对应 architecture debt 全部删除且没有新增诊断。
- [ ] 相关包 test、typecheck、build、consumer smoke 与全仓 architecture tests 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
