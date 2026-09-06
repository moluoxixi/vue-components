# 配置化表单与设计器架构收敛

## Goal
在不破坏现有公开 API 和运行时行为的前提下，收敛配置化表单与设计器之间已经确认的架构重复点，建立可执行的边界检查，为后续 Runtime/Designer 演进降低回归风险。

## Requirements

- 统一 Designer 内部对 JSON 值进行防御性复制的实现，避免同语义 helper 分叉。
- 为 Designer 与 Runtime 的依赖边界增加可执行架构测试，明确真实 Runtime Host 依赖与禁止的深层实现依赖。
- 为现有字段运行链路补充跨层行为一致性测试，覆盖 binding、defaultValue、validation 和 reaction projection 的关键路径。
- 不改变现有公开导出、ProjectDocument schema、Renderer 事件顺序或持久化版本。

## Acceptance Criteria

- [x] 重复 JSON clone helper 被替换为单一共享实现，现有测试通过。
- [x] Designer 依赖边界测试能捕获对 Runtime 私有实现路径的新增依赖。
- [x] 运行时与设计器关键行为测试通过，且不会引入新的 schema 或兼容分支。
- [x] 受影响包的 lint、typecheck、test 和 ConfigForm 包级验证通过。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
