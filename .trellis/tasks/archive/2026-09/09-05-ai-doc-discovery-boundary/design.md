# AI 文档组件发现服务拆分设计

## 模块边界

- `component-discovery.ts`：接收配置、选择 discovery 策略、合并并返回组件源。
- `workspace-resolution.ts`：文件系统与 package metadata 层，解析 workspace、entry、文件和模块路径。
- `component-export-resolution.ts`：TypeScript AST 语义层，递归追踪 import/export 与 barrel。

路径层不理解发现策略，AST 层不枚举 workspace，调度层不直接操作 TypeScript AST。循环检测、缓存和稳定排序由当前实际 owner 保留并通过测试锁定。

## 兼容与回滚

仅移动私有实现，不改变根入口导出。先迁路径层，再迁 AST 层；每一步运行现有 discovery tests，失败时可单独回退。
