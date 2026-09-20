# Studio 业务物料与视觉系统实施计划

## 实现进度

- [x] 固化共同物料矩阵与 capability 对称测试，补齐 Text/Title/Icon/Image/Divider/Button/Link/Tag/Alert/Empty/Pagination。
- [x] 增加 Table/List/Select Dataset capability 与运行组件，复用共享 query/projection，并提供 row/item 只读上下文。
- [x] 接通 Runtime Host 与 Source 的 `rowActivate`/`itemActivate`，补齐 semantic listener 和 nested data 渲染测试。
- [x] 增加 ProjectTheme 编辑器、`project.theme` controller command、Design/Preview CSS variables 与 Source 完整主题输出。
- [x] 补齐 Grid/Flex 响应式配置、受控视觉属性、独立 Required 入口与窄屏可达性。
- [x] 完成双 Provider 对称测试、浏览器矩阵和 README/spec 同步。
- [ ] 随 Demo Studio 收尾批次提交并归档本子任务。

## 验收证据

- Element Plus 与 Ant Design Vue 使用同一 Registry v3 capability 基线；共同 element、Dataset/Resource binding、semantic trigger 和 projection kind 由对称合同测试约束。
- Designer 属性面板将 Required 保持为字段级独立能力，并稳定提供 Properties/Validation/Interactions；属性与校验压力场景、刷新恢复和双 Provider 切换纳入 `interaction.spec.ts` `53/53`。
- Table/List/Select 复用 Model Dataset view；Runtime 与 Source 解析 `rowActivate`/`itemActivate`，不恢复原始 DOM 事件、事件转发或任意函数。
- 主题编辑、Design/Preview token 投影和 CSS/Tailwind Source 输出使用同一结构化 `ProjectThemeV1`；完整 axe 矩阵 `8/8`、模板管理 `14/14`、Workbench 全量 E2E `81/81` 通过。
- Designer `127/127`、Compiler `20/20`、Runtime `137/137`、Source `91/91` 及最终跨包门禁结果记录在父任务验证段。

## 最终验证记录（2026-09-21）

- Designer `127/127`、Element Runtime `13/13`、Ant Design Vue Runtime `13/13`、Designer Element Plus `28/28`、Designer Ant Design Vue `17/17`、Source `91/91`、Workbench `50 files / 564 tests` 通过。
- `interaction.spec.ts` `53/53`、axe `8/8`、模板管理 `14/14`、Workbench 全量 E2E `81/81` 通过。
- 11 个受影响包的 typecheck/build 共 `27/27` tasks、ConfigForm packages `16/16` build tasks、release 38 项、path contracts `8/8` 和 frozen lockfile 校验通过。
- ConfigForm architecture boundaries `7/7` 通过；全仓架构命令只保留两个未修改包的 27 条既有范围外诊断。
