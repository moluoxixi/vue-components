# 富文本编辑器结构治理

## 目标

治理 rich-text-editor 的公开组件、插件入口与内部职责。

## 需求

- 清零 manifest 中归属本任务的组件所有权债务。
- 明确公开 Vue 组件与插件安装入口，私有实现归入责任目录。
- 保持编辑器公开 API、内容模型和交互行为不变。

## 验收标准

- [ ] 对应 architecture debt 全部删除且没有新增诊断。
- [ ] 包级 test、typecheck、build 与全仓 architecture tests 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
