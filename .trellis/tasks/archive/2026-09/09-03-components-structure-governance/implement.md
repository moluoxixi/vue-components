# 通用组件包结构治理实施计划

1. [x] 补 10 个 root/leaf/default/named/install identity characterization。
2. [x] 归位 CopyText/HeadlessCopyText、DateRangePicker、EnterNextContainer 与 Request 三组件，清理跨 feature deep imports。
3. [x] 归位 HeadlessTable SFC/types/composables/utils，并将 renderer 移入 services。
4. [x] 归位 ConfigTable 与 PopoverTableSelect 及其单父私有子组件，保持依赖链只走 feature barrel。
5. [x] 删除 manifest 20 条 debt，更新 README/spec，扫描冗余 src、deep import、cycle、P0/P1/P2。
6. [x] 每批运行 components test/typecheck/build；最终运行 playground E2E、architecture/path/packed/lint 与 `git diff --check`。
7. [x] 独立只读复核后提交、归档并记录 journal，不 push。

## 验证证据

- Components：16 files / 118 tests、typecheck、build 全部通过；build 生成 10 个 playground entries 与稳定组件 JS/d.ts/CSS 产物。
- Public characterization：10 个 root/leaf/default/named/install identity 用例通过；auto-loader 继续从 package exports 双向派生。
- AI Doc 源码消费者：detail 2/2、extractor 26/26 通过，真实 Popover SFC 路径已同步。
- Components Playground：7/7 E2E 通过，覆盖 CopyText、RichTextEditor、DateRangePicker、EnterNextContainer、PopoverTableSelect、HeadlessTable 和侧栏切换。
- Package architecture：11/11，tracked debt 从 48 降至 28，Components 20 条目标 debt 清零。
- Path contracts：8/8 与 playground typecheck 通过；components deep-import exceptions 从 17 条降为 0。
- Packed verifier：全部发布 export 通过，23 个 browser JS entries、3 个 stylesheet entries 和 packed applications 通过 8 个浏览器批次。
- 全仓 lint 与 `git diff --check` 通过。
- 三份独立最终审计未发现结构/行为阻断；确认 10 个 SFC 与两个私有子组件除 import 外行为等价，renderer/Popover listener 合同保持。
