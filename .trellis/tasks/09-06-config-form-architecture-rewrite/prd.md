# 配置化表单与设计器架构重构

## 目标
在产品尚未对外发布的阶段，直接重构配置化表单与设计器架构，建立单一字段语义、单一运行时值源和稳定的 Designer Runtime Host 边界。

## 需求

- Compiler 产出唯一的 JSON-safe CanonicalFieldDescriptor，Model、Designer、Runtime backend 只通过该语义投影协作。
- Renderer controller 移除完整 model 的内部镜像，同步 model.read/write 端口成为唯一值源；同步、校验和 meta 状态分别归属明确服务。
- Designer 不再直接导入 ConfigFormRenderer 或 Runtime 私有组件，只消费 Runtime Host/Canonical IR 合同。
- 删除旧的重复字段规范化和兼容路径，更新所有当前测试、类型、导出和文档。
- 不保留旧 API 别名、迁移器、双形状解析或兼容 fallback。

## 验收标准

- [x] 单一 CanonicalFieldDescriptor 覆盖完整编译、增量编译、Preview 和 Source。
- [x] Renderer controller 使用同步宿主端口作为唯一值源，连续写入和外部覆盖经过执行验证。
- [x] Designer 生产源码不再直接依赖 Runtime Renderer 或 Vue backend 实现路径。
- [x] Core、Runtime、Compiler、Designer、Workbench 相关测试、类型检查和构建通过。
- [x] 清除旧模板链路、FormContext、specimen、本地 Canvas renderer bridge 与 DOM clone fallback。
- [x] Preview 与生成 Source 的字段、Flow 状态和异步校验生命周期行为一致。
- [ ] 完成提交、合并到 main，并删除独立 worktree。

## 边界

- 产品尚未发布，不保留旧 API、事件或类型语义。
- 当前四个内置 catalog 模板继续保留；它们是现役数据模板。
- 用户已授权完成验证后提交、合并 main 和删除 worktree。
