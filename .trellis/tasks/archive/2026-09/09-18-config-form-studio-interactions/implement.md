# Studio 原型交互与体验模式实施计划

## 实现进度

- [x] 以 `SafeExpression`、interaction schema 和 Prototype Runtime reducer 为基线，补齐 shared command/query 与诊断测试。
- [x] 在 Designer Inspector 增加 Interactions tab、规则列表、安全条件、状态/值规则与单一主要 UI 动作编辑。
- [x] 接入 Workbench controller/autosave，使 interaction 更新作为一个可撤销 Model command 持久化。
- [x] 扩展 Runtime Host 与 Source resolver 的 row/item semantic trigger，保持单一主要动作且不暴露原始事件。
- [x] 补齐 nested overlay、参数/结果 assignment、validation gate、焦点恢复和 reset/history E2E。
- [x] 完成 Model/Compiler/Runtime/Designer/Source/Workbench 浏览器矩阵和 README/spec 同步。
- [x] 随 Demo Studio 收尾批次提交并归档本子任务。

## 验收证据

- Inspector 在无节点时提供 Properties/Interactions，在字段节点时提供 Properties/Validation/Interactions；作者可以配置显隐、禁用、只读、动态必填、set/copy/clear 和 navigate/back/open/close。
- Designer interaction 单测覆盖状态规则、值规则、主要动作、目标 Surface、参数和结果映射；更新经 `surface.interactions` command/history/autosave，刷新重开后仍可编辑。
- `interaction.spec.ts` 已验证“创作 -> 保存 -> 重开 -> Preview 执行”的真实路径并以 `53/53` 通过；Workbench 全量 E2E `81/81`，axe `8/8`。
- Model `69/69`、Compiler `20/20`、Prototype Runtime `34/34`、Runtime `137/137`、Designer `127/127`、Source `91/91` 的当前测试批次通过。
- 交互边界保持封闭：无事件编辑器、事件转发、任意函数、HTTP、动作链或通用 handler registry。

## 最终验证记录（2026-09-21）

- Model `69/69`、Compiler `20/20`、Prototype Runtime `34/34`、Runtime `137/137`、Vue backend `11/11`、Designer `127/127`、Source `91/91`、Workbench `50 files / 564 tests` 通过。
- `interaction.spec.ts` `53/53`、axe `8/8`、Workbench 全量 E2E `81/81` 通过；12 张现行 Win32 视觉基线齐全。
- 11 个受影响包的 typecheck/build 共 `27/27` tasks、ConfigForm packages `16/16` build tasks、release 38 项、path contracts `8/8` 和 frozen lockfile 校验通过。
- ConfigForm architecture boundaries `7/7` 通过；全仓架构命令只保留两个未修改包的 27 条既有范围外诊断。
