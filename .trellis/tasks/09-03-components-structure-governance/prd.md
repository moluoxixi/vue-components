# 通用组件包结构治理

## 目标

治理 components 包的组件边界、共享所有权与按需入口。

## 需求

- 清零 manifest 中归属本任务的目录和组件所有权债务。
- 单父和单 Feature 组件下沉到 owner/components，共享组件保留可核验消费者。
- 保持组件公开 API、样式按需入口与交互行为不变。

## 验收标准

- [ ] 对应 architecture debt 全部删除且没有新增诊断。
- [ ] 组件单测、类型检查、构建、playground 验证与全仓 architecture tests 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
