# ConfigForm Source Tailwind v4 输出后端实施计划

## 实现进度

- [x] 固化 `SourceStyleTarget` 和输入归一化，覆盖默认 CSS、显式 CSS、非法目标与确定性测试。
- [x] 抽出 CSS style backend，保持默认产物不变，并让 emitter 通过后端合同消费样式投影。
- [x] 实现 Tailwind v4 backend：公共样式入口、主题 token、完整字面量 utility、Raw package/Vite 插件和受控 CSS 变量。
- [x] 让 ConfigForm binding 导入统一的本地样式入口，并只通过公开 attrs 与生成器自有壳层输出 class。
- [x] 扩展真实 consumer 测试，覆盖 Element Plus、Ant Design Vue Raw Tailwind 工程和 Binding Tailwind library build。
- [x] 在 Workbench 导出会话增加 CSS/Tailwind v4 分段选择并透传 `styleTarget`；ProjectDocument 保持不变，Raw/Binding 继续独立失败。
- [x] 浏览器验证 CSS/Tailwind 切换、Raw/Binding 文件树与源码内容，并同步 Source/Workbench spec 与 README。
- [x] 完成 Source/Workbench test、typecheck、build、发布、frozen lockfile 和任务范围架构门禁。
- [ ] 随本批变更提交并归档任务。

## 验收证据

- Source 单测覆盖省略目标与显式 `css` 字节一致、非法目标 `source_input_invalid` 且零 partial files、相同输入确定性，以及 CSS/Tailwind 的语义 parity。
- Tailwind Raw 工程只把 `tailwindcss`、`@tailwindcss/vite` 放入 `devDependencies`，生成官方 Vite 插件配置、`@import 'tailwindcss'`、完整字面量 utilities 和确定性主题 token。
- ConfigForm binding 只输出公开配置、attrs 和本地样式入口，不嵌入运行核心，也不让 Runtime/Provider adapter 新增 Tailwind 依赖。
- Workbench Export Dialog 的 `styleTarget` 是会话状态；浏览器已确认 Raw Vue 与 ConfigForm binding 的 CSS/Tailwind 文件树和源码可独立切换，Project JSON 不含该字段。
- Source `91/91` 与 Workbench 全量 E2E `81/81` 通过。

## 最终验证记录（2026-09-21）

- Source `91/91`、Workbench `50 files / 564 tests` 通过；11 个受影响 ConfigForm 包的 typecheck/build 共 `27/27` tasks 通过。
- ConfigForm packages `16/16` build tasks 与 public package boundaries 通过；release 38 项、path contracts `8/8`、components playground typecheck 和 frozen lockfile 校验通过。
- Workbench 全量 E2E `81/81`，浏览器确认 CSS/Tailwind v4、Raw/Binding 四种组合的文件树和源码；12 张现行 Win32 视觉基线齐全。
- ConfigForm architecture boundaries `7/7` 通过；全仓 `test:package-architecture` 仍仅被未修改的 `qiankun-router-kit` 与 `vite-plugin-style-scope` 共 27 条既有诊断阻断。

关键命令：`pnpm --filter @moluoxixi/config-form-source test`、`pnpm --filter @moluoxixi/config-form-source typecheck`、`pnpm --filter @moluoxixi/config-form-source build`、`pnpm --filter @config-form/workbench test --maxWorkers=2`、`pnpm --filter @config-form/workbench typecheck`、`pnpm --filter @config-form/workbench build`、`pnpm test:package-architecture`、`pnpm install --lockfile-only --frozen-lockfile`、`git diff --check`。
