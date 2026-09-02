# 全局目录结构规范与重复 Spec 清理

## 目标

将按职责拆分 feature、使用局部 barrel、避免扁平职责文件的目录策略提升为全仓公共规范，并清理 `.trellis/spec` 中重复的占位模板，使每项规则只有一个权威正文，同时保留真实的包级补充约束。

## 背景与事实

- `.trellis/spec` 当前有 345 个 Markdown 文件，但字节级内容仅 42 种。
- 276 个文件仍含 `(To be filled by the team)`，50 个索引仍含 `To fill`。
- 50 份 `directory-structure.md` 中有 46 份为空模板；其余四份包含 ConfigForm、Designer、Docs 和 VitePress Theme 的真实规则。
- `config-form-core/frontend/directory-structure.md` 的当前工作树内容由用户新增，虽位于 Core 层，却声明适用于整个 `packages/ConfigForm/`。
- 包级 `index.md` 是必要的路由入口；具体规范应从索引按需读取，而不是在会话启动时全部注入。

## 需求

1. 在 `.trellis/spec` 建立一份全仓适用的目录结构权威规范，覆盖职责目录、局部 barrel、类型与运行时职责分离、避免无意义空目录、跨 feature 导入和验证要求。
2. 将 ConfigForm Core 中可泛化的目录规则迁入公共规范；ConfigForm 的 current-contract/hard-cut 规则继续由其架构规范负责。
3. 保留 Designer、Docs、VitePress Theme 的真实包级目录约束，但改为只描述公共规范之外的专项补充。
4. 删除所有纯占位 spec 正文，并从包级索引移除对应 `To fill` 项；不得删除任何包含实际项目约束的正文。
5. 所有 package/layer 索引都应链接公共目录规范；有专项规范的索引还应链接本包补充。
6. 清理未注册的遗留 spec 目录；对确有 workspace package 和真实规范的 `ai-provider`、`i18n-tool`、ConfigForm Workbench，补齐 package 注册并迁移到准确的 spec 所有权目录。
7. 修复迁移造成的 Markdown 相对链接，不修改产品代码或其他并行任务文件。

## 验收标准

- [x] 全仓只有一份公共目录拆分策略正文，所有有效 package/layer 索引均可按需访问它。
- [x] `.trellis/spec` 中不再出现 `(To be filled by the team)` 或索引状态 `To fill`。
- [x] 不再保留字节级重复的模板正文；必要的包级索引不视为规范正文重复。
- [x] ConfigForm、Designer、Docs、VitePress Theme 当前工作树中的真实约束均保留在公共规范或明确的专项补充中。
- [x] 未注册且仅含模板的遗留 spec 目录不再污染 SessionStart 的可选索引清单；真实 package 的规范均可通过 package 路由发现。
- [x] 所有本地 Markdown 链接均能解析，Trellis task 校验通过。
- [x] 变更严格限定于本任务记录、`.trellis/spec`、归档和会话日志。

## 范围外

- 不重构产品源码以符合新目录规范。
- 不补写当前仍缺失的组件、状态、错误处理等包级规范。
- 不修改 Trellis 的上下文注入代码；只补齐漏掉的现有 workspace package 映射。
- 不处理与本任务无关的现有未提交改动。
