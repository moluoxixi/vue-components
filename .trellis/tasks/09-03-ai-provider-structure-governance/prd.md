# AI Provider 结构治理

## 目标

治理 ai-provider 的 provider、传输、类型与测试边界。

## 需求

- 清零 manifest 中归属本任务的目录职责债务。
- 将纯类型、运行时服务和 provider 适配放入明确责任目录。
- 保持公开 provider API 与请求行为不变。

## 验收标准

- [ ] 对应 architecture debt 全部删除且没有新增诊断。
- [ ] 包级 test、typecheck、build 与全仓 architecture tests 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
