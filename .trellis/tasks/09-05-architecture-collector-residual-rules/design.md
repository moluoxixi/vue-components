# 架构 Collector 残余规则补齐设计

## 分析边界

- 复用现有 package enumeration、TypeScript AST、Vue SFC 解析和 module graph。
- 将 feature root、公开 barrel reachability、组件 owner 和 composable 语义作为独立派生数据，规则层只产生 diagnostics。
- manifest reconciliation 仍由现有统一流程处理 unknown、stale debt 与 stale exception。

## 规则方向

- 跨 feature 深导入：feature root 排除责任目录下的组件/服务模块，并允许子 feature 读取父 feature 的共享责任目录；其余跨 root 边只允许目标 feature barrel。静态、re-export 和 literal dynamic import 使用同一解析图。
- 共享组件 owner：只对包级 `src/components` 的非公开组件计算独立 feature owner 数，少于两个时产生位置诊断；单父规则仍优先。
- composable 职责：按最近责任目录和导出 `use*` 函数审计，以 AST 调用和依赖传播识别 Vue reactivity、provide/inject、watch/listener 与 lifecycle cleanup；支持 Vue import alias、namespace 与本地 barrel wrapper，不对仅含纯计算的 hook 命名文件放行。
- 精确例外：新增 `importExceptions`，以 importer、resolved target 和 feature rule 精确匹配；`cycle/lazy/platform` 是受 schema 约束的人工审阅理由分类，不伪装为静态可推导属性。路径、目标或 live edge 漂移都会失败。

## 生产代码收口

- Runtime 节点分类守卫移入中立 `src/utils/node.ts`，删除 `runtime/utils` 转发目录，消除 plugins 对 runtime 的反向依赖。
- `useBem` 改为 `utils/createConfigFormBem`；DesignerCanvas 选择事件工厂移入 owner 的 `services/` 私有 leaf，两者都不是公共包根 API。
- AI 文档 vector strategy 继续使用 literal dynamic import，但目标改为 `core/vector/index.ts`；preview browser-safe facade、vector validation 和 Runtime defaults 的窄边以精确 import exception 记录。

## 兼容策略

规则先由 fixtures 锁定，再对全仓运行。发现真实动态语义时使用窄 manifest 例外；发现真实错位时修生产代码并补调用方测试，不批量 baseline。
