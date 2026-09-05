# ConfigForm 交互控件审计

## 结论

- `packages/ConfigForm/workbench/src` 的生产 Vue 模板不再包含原生
  `input`、`textarea` 或 `select`；用户可编辑数据控件统一使用 Element Plus。
- Flow inspector 的流程名称、节点 ID、Action ref、JSON 配置分别使用
  `ElInput` 或 `ElInput type="textarea"`；并发、错误策略和超时继续使用
  `ElSelect`、`ElInputNumber`。
- Workbench 对 Element Plus 输入控件的 feature 样式只保留宽度、textarea
  最小高度、resize 和等宽字体，不覆盖输入边框、背景或 focus ring。
- Workbench 的 Dialog、Drawer、Popover、Dropdown、Tooltip 和 Popconfirm 均由
  Element Plus 提供；未发现第二套手写 overlay 状态机。

## Designer 例外边界

`packages/ConfigForm/designer` 是框架无关底层包，保留原生 property-control
fallback。其样式集中由 `src/styles/native-property-controls.scss` 管理，并由
`designer-style-entries.test.ts` 验证精确作用域和 `focus-visible`。Workbench
绑定 Element Plus adapter 后不得退回这些原生控件。

`DesignerMaterialSpecimen` 的缩略预览使用一条带 `!important` 的高度规则压缩
展示组件。该区域 `pointer-events: none`，只服务不可编辑缩略图；此规则不得扩展
到 Inspector 或 Runtime。

## 根因与防护

本次流程名称样式不一致属于“规范范围遗漏 + 测试覆盖缺口”：全局成熟组件库
合同此前没有明确列出 Input/Textarea/InputNumber，Flow 测试也只验证了 Select 和
InputNumber。现在增加三层防护：

1. 全局组件库合同明确覆盖文本与数字输入。
2. Workbench 架构测试拒绝生产 Vue 模板中的原生可编辑控件。
3. Flow unit/E2E 验证真实 Element Plus wrapper，且禁止恢复原生输入 CSS。

## 验证

- `pnpm --filter @config-form/workbench exec vitest run --config vitest.config.ts src/app/__tests__/architecture-boundary.test.ts src/features/flow/__tests__/flow-workspace.test.ts`
- `pnpm --filter @config-form/workbench typecheck`
- `pnpm lint`
- `pnpm --filter @config-form/workbench exec playwright test --config playwright.config.ts e2e/accessibility.spec.ts e2e/interaction.spec.ts -g "mobile Inspector|edits Flow settings|component event flow|form submit flow"`
- `pnpm --filter @config-form/workbench build`
