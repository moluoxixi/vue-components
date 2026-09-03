# ConfigForm Designer 结构治理

## 目标

治理 Designer、Canvas、Inspector 与适配层的职责和组件所有权。

## 需求

- 清零 manifest 中归属本任务的 Designer 目录与所有权债务。
- 按 Camera、Geometry、Drag、Resize、Overlay、Menu、Inspector 等职责拆分行为热点。
- 继续遵守 current-contract-only，不新增兼容转发层。

## 验收标准

- [ ] 对应 architecture debt 全部删除且没有新增诊断。
- [ ] Designer 相关 test、typecheck、build、package smoke 与全仓 architecture tests 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
