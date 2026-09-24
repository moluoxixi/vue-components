# 执行计划

- [x] 读取架构与规范，完成三项独立探索。
- [x] 固定参考实现版本与重构边界。
- [x] 重写 Core 事件上下文、运行时和图校验，增加关键回归。
- [x] 接入公共表单与 Workbench/iframe，统一值更新和取消顺序。
- [x] 移除 Source 独立执行器，导出同源 TypeScript 内核。
- [x] 完善事件动作编辑、参数引用和草稿错误恢复。
- [x] 运行受影响包单测、类型检查、架构门禁、生成工程构建。
- [x] 启动 Workbench，运行真实浏览器主要事件工作流与响应式检查。
- [x] 更新当前架构文档和规范，记录验证结果与限制。

## 验证命令

按实际修改逐步运行 `pnpm --filter @moluoxixi/config-form-core test`、Runtime/Compiler/Model/Designer 对应测试，以及 `pnpm --filter @config-form/workbench test` 和 `typecheck`。

最终运行 `pnpm test:package-architecture`、`pnpm test:config-form-packages`、Workbench build、导出消费者验证和 `pnpm --filter @config-form/workbench test:e2e`。失败需定位原因；不可通过删断言或兼容分支绕过。

## 验证记录

- Core 55、Headless 29、Runtime 105、Vue backend 9、Compiler 24、Workbench 590 项测试通过。Workbench 使用 `--maxWorkers=2` 降低并行构建时的机器竞争；未放宽性能阈值或测试超时。
- 6 个受影响包类型检查通过；公开包构建与声明消费者验证通过。
- Element Plus、Ant Design Vue 导出工程均独立安装、类型检查并构建通过。
- 完整浏览器套件 81 项中，64 项初次通过；1 项引用已删除的 rose-pine 测试主题，改为当前 ink 后复跑通过。剩余 16 项为仓库缺少 win32 平台截图基线，未把自动生成截图冒充审核过的基线。
- 结构化动作输入、两种 Provider 的事件参数、非 binding 事件、移动端 Inspector 和 Flow 设置均复跑通过。
- `verify-browser.mjs` 在 1440/900/390 下生成真实截图，检查无横向溢出和浏览器异常，事件编辑器 axe WCAG 2/2.1 A/AA 零违规。修复首个动作重叠、流程画布失配和移动端面板遮挡。
- 全仓架构 CLI 有 27 项既有违规，均在 qiankun-router-kit 和 vite-plugin-style-scope；本次 ConfigForm 无违规。完整门禁状态应保留这一限制。
- 本地服务：`http://127.0.0.1:4332/`。
