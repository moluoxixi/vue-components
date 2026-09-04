# 架构 Collector 残余规则补齐设计

## 分析边界

- 复用现有 package enumeration、TypeScript AST、Vue SFC 解析和 module graph。
- 将 feature root、公开 barrel reachability、组件 owner 和 composable 语义作为独立派生数据，规则层只产生 diagnostics。
- manifest reconciliation 仍由现有统一流程处理 unknown、stale debt 与 stale exception。

## 规则方向

- 跨 feature 深导入：比较 importer 与 target 的 feature root；跨 root 时仅允许目标公开 barrel 或显式支持的公共子边界。
- 共享组件 owner：只对包级 `src/components` 的非公开组件计算独立 feature owner 数，少于两个时产生位置诊断；单父规则仍优先。
- composable 职责：以 AST 调用和响应式依赖传播为证据，识别 Vue reactivity、provide/inject、watch/listener 与 lifecycle cleanup；不对仅含纯计算的 hook 命名文件放行。

## 兼容策略

规则先由 fixtures 锁定，再对全仓运行。发现真实动态语义时使用窄 manifest 例外；发现真实错位时修生产代码并补调用方测试，不批量 baseline。
