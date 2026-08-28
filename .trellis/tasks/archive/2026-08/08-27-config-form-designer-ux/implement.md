# Designer 中宽 Inspector Drawer 实施计划

## 实施清单

1. [x] 补 medium 回归测试，先固定 Properties 不得位于 Canvas 下方、drawer 不增加 Designer 高度的失败场景。
2. [x] 抽离 `mediumPanel` 互斥状态，保持 desktop docked booleans 与 narrow active view 的现有行为。
3. [x] 重构 medium workspace CSS 为单一 Canvas area + 左右 absolute drawer，删除 Properties 第二行 grid 与 `34%` row。
4. [x] 增加 drawer close command、Escape 和条件式焦点恢复；保持非模态 Canvas 选择与 node keyboard 行为。
5. [x] 将 PropertyPanel setter 改为稳定纵向字段行，补 label ellipsis/accessibility 与无横向溢出测试。
6. [x] 补 PropertyPanel tab/tabpanel ids、roving tabindex 和 Left/Right/Home/End。
7. [x] 更新 Playground E2E 的 medium 几何、双 adapter drawer 交互与 Chromium 截图，保留 desktop/narrow 回归。
8. [x] 运行 Designer 单测、类型检查、构建、Workbench 嵌入回归、Playwright 与 `git diff --check`。

## 验证结果

- `pnpm lint`：通过。
- `pnpm --dir packages/ConfigForm/designer test`：通过，10 个文件、95 个测试。
- `pnpm --dir packages/ConfigForm/designer typecheck`：通过。
- `pnpm --dir packages/ConfigForm/designer build`：通过。
- `pnpm --dir packages/ConfigForm/workbench typecheck`：通过。
- `pnpm --dir packages/ConfigForm/workbench build`：通过，仅保留既有 chunk size 提示。
- `pnpm --dir packages/ConfigForm/playground typecheck`：通过。
- `pnpm --dir packages/ConfigForm/playground test:e2e -- --grep "designer"`：通过，Chromium 8/8。
- `git diff --check`：通过，仅有工作区既有 LF/CRLF 提示。

## 预计改动范围

- `packages/ConfigForm/designer/src/components/ConfigFormDesigner.vue`
- `packages/ConfigForm/designer/src/components/DesignerPropertyPanel.vue`
- `packages/ConfigForm/designer/src/styles.scss`
- `packages/ConfigForm/designer/__tests__/designer.test.ts`
- PropertyPanel 相关测试
- `packages/ConfigForm/playground/e2e/config-form-playground.spec.ts`
- Chromium medium screenshot baseline

## 验证命令

```powershell
pnpm --dir packages/ConfigForm/designer test
pnpm --dir packages/ConfigForm/designer typecheck
pnpm --dir packages/ConfigForm/designer build
pnpm --filter @config-form/playground test:e2e -- --project=chromium --grep "designer"
pnpm --dir packages/ConfigForm/workbench typecheck
pnpm --dir packages/ConfigForm/workbench build
pnpm exec eslint .
git diff --check
```

## 风险门

- 不修改 Designer 文档、history 或 adapter API。
- 不把 drawer 实现为 modal dialog，不给 Canvas 增加 inert/scrim。
- 不用 `v-if` 重建 Palette/PropertyPanel。
- 不恢复 medium Properties 第二行作为 fallback；宽度不足时进入 narrow tabs。
