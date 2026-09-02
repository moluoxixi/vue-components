# ConfigForm Workbench 模板创建页精修实施计划

## 1. 开发前

- [ ] 主题、设计器子任务通过后启动本子任务，并加载 `trellis-before-dev`。
- [ ] 记录当前 catalog load、筛选、roving focus、eligibility、preview race、创建事务与 1440/900/390 几何基线。
- [ ] 确认模板 manifest、Catalog Service、adapter loader 和 RuntimeHost 都不需要契约变更。

## 2. 视图状态

- [ ] 为 fatal catalog load error 增加独立局部状态，保留 partial diagnostics 表达。
- [ ] 建立互斥 computed view states，拆分 loading/error/filtered-empty/no-selection/eligibility/preview/submitting。
- [ ] 为每个状态补齐 zh-CN/en-US 标题、原因和唯一明确的下一步动作。
- [ ] 增加仅展示用 eligibility cache，key 固定为 `templateId + target + registryLock fingerprint`；只写入现有选中项检查结果，target/fingerprint 变化后不得读取旧结果，不预加载全部 adapter，不改变创建门禁。

## 3. 布局与目录

- [ ] 1001 像素以上使用 280–340 像素紧凑目录 + 自适应详情/预览。
- [ ] 641–1000 像素实现 52–56 像素 category rail 和按需 `ElDrawer` 目录，详情/预览占主空间。
- [ ] 640 像素以下用 `ElSegmented` 切换 Catalog/Details，默认 Catalog，保留 Enter/Escape 行为。
- [ ] 目录行增加 category、adapter/provider 与真实/待检查资格状态，保持 listbox/option 和 roving tabindex。
- [ ] 保留详情身份、eligibility、Runtime iframe 与 sticky create；保证 footer 不覆盖滚动内容。
- [ ] 为中屏目录 Drawer 实现 Escape 关闭、关闭后焦点返回 rail 触发器，以及与外观设置 Drawer 的互斥打开规则；不得产生嵌套 Drawer。

## 4. 成熟组件与主题

- [ ] 保留/使用 `ElInput`、`ElSelect`、`ElSegmented`、`ElDrawer` 和 `ElButton` 的按需导入。
- [ ] 使用 Lucide 图标和 Tooltip/aria-label 表达窄 rail，不手绘 SVG 或创建 Base UI 抽象。
- [ ] 全部页面/overlay 样式消费父主题 semantic token，清理模板页局部硬编码品牌色。
- [ ] 确认 Preview Runtime iframe 未接收 palette/theme token。

## 5. 验证

- [ ] 扩展 `template-creation-workspace.test.ts` 覆盖九类状态（catalog loading、fatal load error、partial diagnostics、filtered empty、no selection、eligibility checking/blocked、preview error、submitting）、资格 cache key/失效、Drawer/segmented 与焦点恢复。
- [ ] 扩展 `template-management.spec.ts` 覆盖 1440/900/390 布局、无横滚、长诊断、搜索筛选、移动返回和创建路径。
- [ ] 重跑 preview race、stale result、eligibility disabled reason、controller busy 和重复提交测试。
- [ ] 运行四 palette × Light/Dark 的模板根/overlay contract，并验证 Preview iframe computed style 不变。
- [ ] 人工检查父视觉矩阵分配的 900/390、zh/en 模板哨兵，不新增完整笛卡尔截图。
- [ ] 运行：
  - `pnpm --filter @config-form/workbench test`
  - `pnpm --filter @config-form/workbench typecheck`
  - `pnpm --filter @config-form/workbench build`
  - `pnpm --filter @config-form/workbench test:e2e -- template-management.spec.ts`
  - `pnpm lint`
  - `git diff --check`

## 6. 评审与回滚

- [ ] 独立确认 Catalog/manifest/eligibility/RuntimeHost/创建事务合同未改变。
- [ ] 独立确认 900 像素 Drawer 与移动 segmented 不产生嵌套 overlay、焦点陷阱或重复导航。
- [ ] 任一 preview race、创建门禁或键盘合同失败时，回滚展示层并保留父主题基础设施。
