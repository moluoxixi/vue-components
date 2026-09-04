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

- [ ] 28 条目标 debt 全部删除，全仓 architecture tracked debt 为 0。
- [ ] 7 个 public exports 的 source/types/import、runtime keys、build outputs、CLI 与 CSS 保持不变。
- [ ] 所有目标 feature `index.ts` 仅导出，旧 flat/private paths 不存在且无 forwarding shim/deep import/cycle。
- [ ] Markdown demo ID/line provenance、external playground、source links 和 routes 输出保持不变。
- [ ] Repository browser/provider capability、Node collector/dynamic dispatch、snapshot validation 与 atomic write 保持不变。
- [ ] CLI prepare/build/dev/preview、step order、environment mutation、lock 与 redaction 保持不变。
- [ ] 包级 test/typecheck/build/provenance/consumer/fixture/E2E 与全仓 architecture/path/packed/lint 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
- 不修改 `src/upstream`、Provider API 协议、项目配置 schema、生成产物格式或视觉设计。
