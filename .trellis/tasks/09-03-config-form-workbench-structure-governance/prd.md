# ConfigForm Workbench 结构治理

## 目标

治理 Workbench 的应用编排、Feature 私有组件与大型控制器。

## 需求

- 清零 manifest 中归属本任务的 Workbench 目录与所有权债务。
- 私有组件归入所属 Feature，按 Source、App controller、Flow、Monaco、RuntimeHost 拆分热点。
- 保持 Workbench 用户行为、数据协议和视觉结果不变。

## 验收标准

- [ ] 对应 architecture debt 全部删除且没有新增诊断。
- [ ] Workbench test、typecheck、templates、build、E2E 与全仓 architecture tests 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
