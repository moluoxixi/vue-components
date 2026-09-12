# 执行与验收计划

## 当前阶段

目标合同已批准，执行不再次请求范围审批。父任务负责集成，子任务负责独立交付；未通过项保持开放。

- [x] 读取目标、现有架构改动、项目规范和知识库。
- [x] 重新调度全部调查为受支持的 GPT 模型。
- [x] 完成运行时/设计器静态差距审查及现有测试基线。
- [ ] 整理产品实际操作证据并补齐 VForm 剩余路径。
- [ ] 修复 Compiler 目录断言及 Designer 类型错误，不弱化测试。
- [ ] 冻结共享合同：步骤树到 DAG、动作描述、值引用/生命周期/trace、页面变量数据源、数据作用域。
- [ ] 实现事务式可视化事件编辑和参数/条件选择器。
- [ ] 实现变量/数据源共享运行器和可测试管理界面。
- [ ] 实现控制器生命周期、提交阻断、重入与异步取消。
- [ ] 实现对象/重复数组/明细表格及双组件库物料、行身份与校验联动。
- [ ] 完成引用完整性、复制/重命名/删除、编译/导入/持久化往返。
- [ ] 完成直接 Runtime/Preview/独立 Source 三路径 parity 与绑定缺失诊断。
- [ ] 完成双组件库资料、明细订单、异步提交流程三个业务场景。
- [ ] 审查修改、修复缺陷并跑完整质量门禁、指定视口和无障碍。
- [ ] 更新 README、规范、示例、路线图、验收台账与会话记录。

## 代理与文件所有权

调查仅只读；产品报告代理仅写研究子任务。每次实施分工固定最小文件集合，公共 barrel 由该阶段唯一所有者更新；下一层在前置公共合同合并后再启动。运行时与编辑器可在冻结接口后并行。主代理负责集成、模型/编译边界和最终判定。

## 验证命令

- `pnpm --workspace-concurrency=1 --no-bail --filter './packages/ConfigForm/**' --filter '!@config-form/playground' --filter '!@config-form/workbench' -r test`
- 同范围 `typecheck` 与必要 `build`，先核对 pnpm 参数支持。
- `pnpm --filter @config-form/workbench test --maxWorkers=2`
- `pnpm --filter @config-form/workbench typecheck`
- `pnpm --filter @config-form/workbench build`
- `pnpm --filter @config-form/workbench verify:templates`
- `pnpm --filter @config-form/workbench test:e2e`
- `pnpm test:config-form-packages`、`pnpm test:performance`、受影响文件 ESLint 与包架构门禁。
- 真实独立生成工程安装/类型检查/构建/执行，不能仅快照字符串。

完整日志写会话临时目录，正式台账记录命令/退出码/计数/证据。基线递归任务首错终止的未执行包不能计为通过。不得跳过关键测试、删除有效断言或放宽性能预算。

## 恢复与回退

保存每一阶段公开合同与测试结果；失败时只修复本阶段改动。不得 git reset/checkout 清除用户工作。对新 schema 明确拒绝旧输入，不自动覆盖或清空仓库持久化数据。
