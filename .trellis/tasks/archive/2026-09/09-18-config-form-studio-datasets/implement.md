# Studio 数据集与静态资源实施计划

## 实现进度

- [x] 在 Model 增加 Dataset/Resource transfer v1、raw ingestion、own-property 路径读取、projection/query 服务与精确诊断。
- [x] 为 nested rows、options scalar 唯一性、稳定查询、Reader fail-closed、bytes/hash/预算和不可变性补齐单测。
- [x] 删除 Source emitter 的私有 Dataset projection，改用 Model 共享服务并补齐 Raw/Binding parity 测试。
- [x] 增加 Workbench Dataset/Resource feature、controller commands、资产树操作、JSON 编辑和导入导出。
- [x] 接入覆盖/副本/跳过冲突策略、Repository 原子 bytes、重命名和删除引用诊断。
- [x] 双 Provider Select/Table/List 按 capability 消费 Dataset projection；“内联 options 保存为 Dataset/解除引用快照”均为单事务命令。
- [x] 完成双 Provider、刷新恢复、`390/900/1440` 视口和 JSON 导入浏览器验证，并同步 README/spec。
- [x] 随 Demo Studio 收尾批次提交并归档本子任务。

## 验收证据

- Model 的 Dataset 服务覆盖 raw rows ingestion、精确 v1 envelope、嵌套字段路径、options/table/list projection，以及 filter -> stable sort -> page；Source 直接调用同一 `queryDatasetView`。
- Workbench controller 单测覆盖 Dataset 绑定、查询投影、内联 options 保存为 Dataset、解除引用物化快照和被引用资产删除保护；项目/Surface JSON 导入 E2E `4/4` 通过。
- 资产面板浏览器流程覆盖新建 Dataset、编辑对象数组 JSON、保存并从资产树重开；`interaction.spec.ts` `53/53`、Workbench 全量 E2E `81/81` 通过。
- Model `69/69`、Source `91/91` 及最终跨包门禁结果记录在父任务验证段；全仓 package architecture 仍只受两个未修改包的 27 条既有诊断阻断。

## 最终验证记录（2026-09-21）

- Model `69/69`、Source `91/91`、Workbench `50 files / 564 tests` 通过；项目/Surface JSON 导入 E2E `4/4`、Workbench 全量 E2E `81/81` 通过。
- 11 个受影响 ConfigForm 包的 typecheck/build 共 `27/27` tasks 通过；`test:config-form-packages` 的 `16/16` build tasks 与 public package boundaries 通过。
- `test:release` 38 项、path contracts `8/8`、components playground typecheck 和 frozen lockfile 校验通过。
- ConfigForm architecture boundaries `7/7` 通过；全仓架构命令的 27 条既有范围外诊断保持原样，未添加豁免。

关键命令：`pnpm --filter @moluoxixi/config-form-model test`、`pnpm --filter @moluoxixi/config-form-source test`、`pnpm --filter @config-form/workbench test --maxWorkers=2`、`pnpm --filter @config-form/workbench typecheck`、`pnpm --filter @config-form/workbench build`、`pnpm test:package-architecture`、`git diff --check`。
