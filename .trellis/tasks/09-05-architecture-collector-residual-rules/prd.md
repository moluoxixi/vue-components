# 架构 Collector 残余规则补齐

## 目标

让 package architecture collector 自动验证跨 feature 导入、包级共享组件 owner 和 composable 职责，消除“当前代码人工审计无违规，但未来回归无法阻止”的缺口。

## 背景

- 当前 collector 已验证包根入口、feature/barrel/types 和单父/单 feature 组件位置。
- 它尚未显式诊断跨 feature 深导入、包级共享组件少于两个独立 feature owner、无 Vue 响应式职责的 composable。
- 当前生产代码未发现明确的跨 feature 深导入；`ConfigForm/runtime/src/composables/useNamespace.ts` 中 `useBem` 是需要结合响应式依赖语义复核的候选，而非预先判定的违规。

## 需求

- 基于现有 AST/module graph 增加三类稳定诊断，禁止用正则替代语义分析。
- 跨 feature 引用必须经过目标 feature 的公开 barrel；同 feature 内部和为避免循环或平台 eager dependency 的精确例外保持可表达。
- 包级共享 Vue 组件必须至少有两个独立 feature owner，公开、动态和框架组件继续使用现有精确 manifest 语义。
- composable 规则只诊断确定缺少响应式状态、注入、监听器或生命周期职责的实现，避免仅凭文件名或 API 名称误报。
- 每类规则必须有正例、反例、例外和 stale manifest 测试。

## 验收标准

- [ ] 三类新规则均进入 `collectPackageArchitectureDiagnostics` 并具有稳定 rule id。
- [ ] fixtures 覆盖静态导入、动态字面量导入、barrel reachability、owner 数量和 composable 语义。
- [ ] 现有 33 个包通过检查且无未知、陈旧 debt/exception。
- [ ] 对 `useBem` 的最终归属有代码证据和测试，不以猜测移动公开 API。
- [ ] package architecture CLI 保持只读并拒绝未知参数。
- [ ] lint、相关 unit、typecheck 与 `git diff --check` 通过。

## 范围外

- 不在本任务拆分 P2 大文件。
- 不扩大 manifest 例外为目录级逃生口。
- 不因规则实现方便而改变现有公共导出。

## 阻塞问题

无。
