# VitePress Element Plus 主题结构治理

## 目标

治理主题包的 Markdown、REPL、组件、CLI 与 upstream 边界。

## 背景

- 当前全仓剩余 28 条 debt 全部归属本任务：1 个 Demo 单父组件、9 个含逻辑 `index.ts`、18 个 feature 根实现文件。
- 稳定公开入口为 `.`, `./markdown`, `./node`, `./repository`, `./repository/node`, `./repl`, `./repl.css`，对应 build/provenance/CLI 产物不得变化。
- Browser runtime、Markdown transform、Node lifecycle、repository provider collectors 与 project config 是不同运行时边界；Node builtin 不得进入 browser entry。
- `src/upstream/vitepress` 是记录 provenance 的第三方源码边界，目录与内容不参与本地所有权重构。

## 需求

- 清零 manifest 中归属本任务的目录和组件所有权债务。
- 保持 vendored upstream 边界，将本地 Markdown、REPL、组件和 CLI 职责分离。
- 将 DemoSource 归入 ElementPlusDocsDemo owner/components，并保持折叠、v-html 和源码显示行为。
- 将 Markdown demo/playground/project/source、Routes、Project config 拆为纯 barrel 与 services/types/defaults/utils。
- 将 browser repository providers 拆为 adapters 与 registry services，解除 provider leaf deep import。
- 将 Node content/playground/lifecycle/config loader 拆入 services/adapters，保持 prepare 顺序、环境变量、lock 与 CLI 路由。
- 将 Node repository runtime、API client、provider collectors 与 sync 拆入 services/adapters，保持动态 provider dispatch、原子写与错误脱敏。
- 补全 root/repository/repl exact runtime export 与全部旧路径/纯 barrel characterization。
- 保持主题公开 API、渲染结果、CLI 与 provenance 合同不变。

## 验收标准

- [x] 28 条目标 debt 全部删除，全仓 architecture tracked debt 为 0。
- [x] 7 个 public exports 的 source/types/import、runtime keys、build outputs、CLI 与 CSS 保持不变。
- [x] 所有目标 feature `index.ts` 仅导出，旧 flat/private paths 不存在且无 forwarding shim/deep import/cycle。
- [x] Markdown demo ID/line provenance、external playground、source links 和 routes 输出保持不变。
- [x] Repository browser/provider capability、Node collector/dynamic dispatch、snapshot validation 与 atomic write 保持不变。
- [x] CLI prepare/build/dev/preview、step order、environment mutation、lock 与 redaction 保持不变。
- [x] 包级 test/typecheck/build/provenance/consumer/fixture 与全仓 architecture/path/packed/lint 通过；完整 E2E 已执行且无本次结构迁移导致的新失败，既有文档 UI/E2E 基线继续由 `09-02-docs-audit-fixes` 处理。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
- 不修改 `src/upstream`、Provider API 协议、项目配置 schema、生成产物格式或视觉设计。

## 验收证据

- `pnpm --filter @moluoxixi/vitepress-theme-element-plus test`：31 个文件、227 项测试通过，consumer fixture 构建通过。
- `pnpm --filter @moluoxixi/vitepress-theme-element-plus typecheck`、`build`、`build:fixture`：通过；fresh build 后 provenance 校验通过。
- `pnpm test:package-architecture`：33 个包、0 条 tracked debt；`pnpm test:path-contracts` 通过。
- `node scripts/verify-published-packages.mjs --browser`：28 个可发布包、23 个浏览器 JS entry、3 个样式 entry 与 8 批 packed browser application 通过。
- `pnpm lint`、`git diff --check`：通过。
- 四路迁移后只读审计未发现行为回归；最终复核发现并修正 Node lifecycle 门禁递归扩展名不一致。
- 完整 E2E 从首次 Node 24 目录导入启动失败推进到 9/17；已修复原生 ESM 入口和浏览器 `node:fs` 泄漏。其余 Demo 冷启动、ConfigForm 搜索物料、假头像网络和视觉基线失败与 `09-02-docs-audit-fixes` 的既有验收项一致。
