# ConfigForm Workbench 组件化视觉重构实施计划

## 1. 实施顺序

1. 基线审计：列出 Workbench/Designer 通用控件、领域组件、现有 keyboard/ARIA/data-testid 和截图基线。
2. 构建接入：为 Workbench 配置 Element Plus resolver、按需样式与类型声明，增加禁止全量导入和 bundle 审计。
3. 视觉令牌：收口 Light/Dark token、排版、边界、焦点和 reduced-motion；保持 Canvas/Runtime iframe 样式隔离。
4. 高频命令区：迁移 Topbar、toolbar、Tooltip、Dropdown、ButtonGroup、状态与可撤销通知。
5. 左侧工作区：迁移 Tabs、搜索、滚动、空状态和 Tree 外壳，保留 Layers/Page/History 领域投影与命令。
6. Inspector：用 Element Plus Form/Input/InputNumber/Switch/Select/Segmented/Collapse 渲染 Registry setter，验证单选、多选和动态 tab。
7. 辅助工作区：迁移 Preview、Export、Page Manager、Persistence、Template、Flow 的通用 Dialog/Drawer/Tabs/Alert 外壳。
8. 删除已替代的手写状态机与 CSS，禁止新增 Base UI 抽象；更新 ConfigForm 架构/状态规范。
9. 完成 1440/900/390、Light/Dark、zh-CN/en-US 截图自审，并与 Figma/Framer/VS Code/Linear 的信息密度、焦点和面板行为逐项对照。
10. 跑完整质量门禁，提交并归档子任务；随后回到父任务整体验收。

## 2. 每批验证

- 组件单测：受控值、事件、disabled/readonly、键盘、焦点恢复、i18n。
- Designer：selection、drag、resize、camera、快捷键、History、notice。
- Workbench：双 Provider 全物料、Design inert、Preview interactive、Export、Flow、Page Manager。
- 视觉：1440/900/390 × Light/Dark × zh-CN/en-US，无溢出、遮挡、文字截断和不可辨识操作。
- 可访问性：axe 0 新增 WCAG 2 A/AA 问题，菜单/Tree/Dialog/Drawer 焦点闭环。

## 3. 质量命令

```powershell
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @moluoxixi/config-form-designer build
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench test:e2e
pnpm lint
git diff --check
```

## 4. 风险与止损点

- Element Plus DOM 层级可能影响 overlay hit testing：Canvas 批次单独迁移，geometry 误差超过 1px 即回滚该控件。
- TreeV2 的多选/拖拽语义与 Project Command 不同：只使用其渲染和可访问性能力，禁止启用第二套业务排序状态。
- Dialog/Drawer 的 Teleport 必须留在 Workbench realm，不能进入 Runtime iframe；两套 Provider 的弹层继续由各自 iframe 承载。
- Resolver 配置若导致全量 CSS 或声明漂移，先修构建边界，不用手工全量 import 绕过。
