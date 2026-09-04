# I18n Tool 结构治理

## 目标

治理 `packages/i18n-tool` 的 UI owner、config/core/server 责任目录和 CLI/发布入口，使扫描、翻译、预览、写入与浏览器工作台可按职责定位，同时保持本地安全协议、命令行、生成内容、UI 行为和公开 API 不变。

## 背景

- Architecture manifest 有 24 条本任务精确 debt：5 条 App 单父组件、3 条 config 根文件、8 条 core 根文件、8 条 server 根文件。
- 稳定公开入口为 `.`, `./core`, `./config`, `./protocol`, `./server`，CLI 仅通过 `i18n-tool` bin 暴露；不新增 `./cli` package subpath。
- 核心安全链为 `scanId/resource/unit IDs -> translate -> previewToken/files/diff -> apply(previewToken) -> fresh scan`，浏览器不得提交路径或磁盘 operation。
- 最大生产文件 `ServerContext` 471 行，低于父任务 P2 >500 阈值，且单一拥有 scan/translate/preview/apply 安全事务；本任务按责任迁移，不机械拆函数体。
- 当前约 68 个 unit 与 5 个 browser E2E 覆盖主要 config/core/server/UI 行为；CLI 只有纯参数解析测试，缺进程级 stdout/stderr/exit characterization。

## 需求

1. 清零 24 条 architecture debt，不新增 unknown/stale diagnostic，不保留旧私有路径 forwarding shim。
2. 将 App 与五个单父 UI 组件归入 `ui/App`；将 App 私有 HTTP client 和 reducer 分别归入 `App/services`、`App/state`，模板/样式与交互行为不变。
3. 将 config 拆为 `schemas`、`services`、`types`，保持 Jiti 配置动态加载、默认发现与 CLI precedence 不变。
4. 将 core 拆为 `constants`、`types`、`utils`、`services`、`adapters`；browser-safe protocol 仍只依赖 diagnostic constants，不吸收 server/filesystem 实现。
5. 将 server 拆为 runtime、resources、filesystem、http domain；具体实现进入各 domain 的 services/adapters，stable errors进入 `server/errors`。
6. 保持 root/core 等价公共符号、config/protocol/server 符号、五个 package exports、CLI bin、`dist/{index,core,config,protocol,server,cli}` 与 `dist/ui` 不变。
7. 补 CLI help/success/config error/invalid option 的进程级 stdout/stderr/exit characterization；复用 router/context/filesystem/core/UI/E2E 覆盖结构移动。
8. 保持 Vite peer、Jiti config import、AI provider 与 UI browser/server 隔离；README 更新公开入口/CLI 用法，但不改变产品配置语义。
9. 每批独立提交，运行 package test/typecheck/coverage/build/E2E、packed Node/browser、architecture/path/workflow 与全仓 lint。

## 验收标准

- [x] 24 条目标 debt 删除，architecture unknown/stale 为零。
- [x] 五个 UI 组件位于 App owner，旧 `ui/components`/`ui/views`/`ui/App.vue` 不存在。
- [x] config/core/server feature 根只含入口与责任目录；旧根实现路径不存在。
- [x] 浏览器只提交 opaque IDs/tokens；scan/translate/preview/apply、path guard、atomic write与rollback语义不变。
- [x] CLI options/stdout/stderr/exit、五个 exports/bin/产物名及所有公共符号不变。
- [x] Jiti、AI Provider、Vite/UI 与 browser/server 边界无新增 cycle、错误 eager import或 secret/path 泄漏。
- [x] README/spec/evidence 与最终结构一致，P0/P1/P2 扫描有结论。
- [x] package/full repository/packed/browser gates与独立 review通过；提交但不 push，保留用户无关改动。

## 范围外

- 不新增 `./cli` export、资源格式、Provider、API route、配置字段、强制覆盖或任意路径写入。
- 不补做与结构迁移无直接关系的完整 apply race/HTTP 错误矩阵；既有安全测试继续作为基线。
- 不改变 UI 视觉、文案、键盘/触屏交互或 Element Plus 使用。
- 不修改用户正在编辑的 ConfigForm Designer 文件。

## 关键决策

- `I18N_DIAGNOSTIC_CODES` 从 mixed types 文件进入 Core constants，保证 protocol 的 browser-safe value edge。
- server 使用 `runtime/services`、`resources/services`、`filesystem/services`、`http/adapters`，避免新的平铺 domain root debt。
- CLI 保持 bin-only；已存在构建产物不等于应新增 public subpath。
- 父任务 standing approval 覆盖内部重构与 phase transition；只有公共 API、行为或跨包依赖方向变化才重新确认。
