# 通用组件包结构治理实施计划

1. [ ] 补 10 个 root/leaf/default/named/install identity characterization。
2. [ ] 归位 CopyText/HeadlessCopyText、DateRangePicker、EnterNextContainer 与 Request 三组件，清理跨 feature deep imports。
3. [ ] 归位 HeadlessTable SFC/types/composables/utils，并将 renderer 移入 services。
4. [ ] 归位 ConfigTable 与 PopoverTableSelect 及其单父私有子组件，保持依赖链只走 feature barrel。
5. [ ] 删除 manifest 20 条 debt，更新 README/spec，扫描冗余 src、deep import、cycle、P0/P1/P2。
6. [ ] 每批运行 components test/typecheck/build；最终运行 playground E2E、architecture/path/packed/lint 与 `git diff --check`。
7. [ ] 独立只读复核后提交、归档并记录 journal，不 push。
