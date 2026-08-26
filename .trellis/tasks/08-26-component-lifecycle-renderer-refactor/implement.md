# 实施计划

## 1. PopoverTableSelect 生命周期修复

- [x] 在 `usePopoverTableSelectBase` 增加生命周期激活门闩和统一停用清理函数。
- [x] 将外部点击监听的延迟安装改为执行时检查生命周期与当前可见性。
- [x] 调整 `cleanupEventListeners`，确保 document listener 总能独立清理。
- [x] 让 `virtualRef` watcher 只在激活状态安装新节点监听。
- [x] 在现有测试文件补充隐藏、卸载和 KeepAlive 停用竞态覆盖。
- [x] 运行 PopoverTableSelect 定向测试。

## 2. ConfigTable renderer 去重

- [x] 抽取单元格 mode state/actions 内部 helper，保持惰性错误与 raw value 语义。
- [x] 让 slot scope 与 renderer scope 复用 helper，但继续分别组装列集合字段。
- [x] 抽取虚拟单元格事件参数解析 helper，保留两个类型明确的 emit handler。
- [x] 为 `slotsVersion` 强制响应式读取补充“为什么”注释。
- [x] 补充 scope actions、列集合和 click/dblclick payload 回归测试。
- [x] 运行 ConfigTable 定向测试。

## 3. 全量验证

- [x] 运行 `pnpm --filter @moluoxixi/components test`。
- [x] 运行 `pnpm --filter @moluoxixi/components typecheck`。
- [x] 运行 `pnpm lint`。
- [x] 检查 diff，确认无公开 API、错误文本或不相关文件变化。
- [x] 运行 Trellis 全范围质量检查并记录结果。

## 验证结果

- `pnpm --filter @moluoxixi/components test`：20 个测试文件、126 条测试全部通过。
- `pnpm --filter @moluoxixi/components typecheck`：通过。
- 本任务四个改动文件的 ESLint：通过。
- `git diff --check`（本任务代码）：通过，仅有仓库既有的 LF/CRLF 提示。
- 根 `pnpm lint` 已执行；失败仅来自独立 AI 文档 UI 工作新增的 `packages/ai-doc-assistant/__tests__/workspace-topbar.test.ts:23` 两处 `style/quote-props`，按用户要求未修改该模块。
- 独立只读核验提出的 pending 生命周期时序和有效 row id mode actions 覆盖缺口均已补测。

## 回滚点

- PopoverTableSelect 与 ConfigTable 修改互相独立；任一部分验证失败可单独回退并重新设计，不影响另一部分。
- 不修改构建配置、包清单和公开类型，因此不需要迁移或发布期兼容层。
