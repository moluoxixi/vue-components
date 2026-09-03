# I18n Tool 结构治理

## 目标

治理 i18n-tool 的 CLI、UI、扫描、转换与持久化职责。

## 需求

- 清零 manifest 中归属本任务的目录和组件所有权债务。
- 按 CLI、UI、扫描、解析、转换和存储边界拆分实现。
- 保持命令行协议、生成内容和 UI 行为不变。

## 验收标准

- [ ] 对应 architecture debt 全部删除且没有新增诊断。
- [ ] 包级 test、typecheck、build、CLI/UI 集成测试与全仓 architecture tests 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
