# VitePress Element Plus 主题结构治理

## 目标

治理主题包的 Markdown、REPL、组件、CLI 与 upstream 边界。

## 需求

- 清零 manifest 中归属本任务的目录和组件所有权债务。
- 保持 vendored upstream 边界，将本地 Markdown、REPL、组件和 CLI 职责分离。
- 保持主题公开 API、渲染结果、CLI 与 provenance 合同不变。

## 验收标准

- [ ] 对应 architecture debt 全部删除且没有新增诊断。
- [ ] 包级 test、typecheck、build、provenance、fixture 与全仓 architecture tests 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
