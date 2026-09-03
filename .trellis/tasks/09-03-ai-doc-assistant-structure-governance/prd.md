# AI 文档助手结构治理

## 目标

治理 ai-doc-assistant 的 UI、CLI 与服务目录职责及组件所有权。

## 需求

- 清零 manifest 中归属本任务的 Feature 根文件和组件所有权债务。
- 分离 CLI、UI、服务、类型与构建入口职责，框架入口只保留编排。
- 保持命令行协议、生成结果和 UI 行为不变。

## 验收标准

- [ ] 对应 architecture debt 全部删除且没有新增诊断。
- [ ] 包级 test、typecheck、build、CLI/UI 集成测试与全仓 architecture tests 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
