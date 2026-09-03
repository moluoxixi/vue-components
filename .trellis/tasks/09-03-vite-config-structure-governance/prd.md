# Vite Config 结构治理

## 目标

治理 vite-config 的配置工厂、addons、解析与适配职责。

## 需求

- 清零 manifest 中归属本任务的目录职责债务。
- 按配置工厂、插件 addons、解析、默认值和适配职责整理目录。
- 保持所有公开配置 API 与生成的 Vite 行为不变。

## 验收标准

- [ ] 对应 architecture debt 全部删除且没有新增诊断。
- [ ] 包级 test、fixture、typecheck、build 与全仓 architecture tests 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
