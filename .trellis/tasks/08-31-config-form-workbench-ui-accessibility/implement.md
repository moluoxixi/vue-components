# ConfigForm Workbench 视觉与可访问性交互实施计划

## 1. 实施顺序

1. 建立基线清单：枚举 Topbar、Workbench toolbar、Designer sidebar、Canvas/Camera、node toolbar 的 icon commands，记录 label、shortcut、disabled reason、当前 tooltip 与 1440/900/390 可见性。
2. 先补失败测试：为命令提示、Palette hard cut、空画布零几何、Camera bounding box、900/390 overflow、对比度与 Runtime computed-style 指纹建立定向单测/E2E。
3. 实现统一命令提示：增加 Workbench virtual Tooltip host 和中性命令元数据，迁移已有重复 `ElTooltip`；补齐中英文名称、真实快捷键、disabled reason、Escape、focus、collision、coarse pointer 与 reduced-motion。
4. 收口 Palette：删除 Palette Runtime specimen，统一 icon/fallback + display name 行；关闭 Workbench 内部重复搜索，同时保持通用 Designer 默认搜索、click add、pointer drag 和 keyboard drag。
5. 重做空画布提示：按 projected graph 判断，改为不参与布局和 hit-test 的 absolute overlay；验证空 Page 的 drop、Preview、Config/Source Export 与 geometry。
6. 调整 Camera：移到 Canvas 右下角，加入滚动安全区和 responsive inset；补齐 tooltip/disabled reason，复跑 zoom、100%、fit、pan、intrinsic frame 与 overlay geometry。
7. 收口 Topbar overflow：建立 action priority，把 status/低优先级命令投影到 Element Plus More actions；保证 visible/overflow 共用原 emit，并验证菜单键盘与焦点恢复。
8. 强化主题与 motion：补充实际 token 配对、focus/icon/border 对比度，扩展 reduced-motion，并确保 Workbench theme 不影响 Design/Preview Runtime computed style。
9. 完成 1440/900/390 × Light/Dark × zh-CN/en-US 的确定性视觉截图和 axe/keyboard 回归；人工复核长文案、tooltip collision、Camera/toolbar 相交和触屏目标尺寸。
10. 运行完整质量门禁；按架构规范判断是否需要更新 `packages/ConfigForm/README.md`，完成独立 Trellis check 后再进入提交确认。

## 2. 重点测试

- `WorkbenchTopbar`/Tooltip host：命令清单、virtual trigger、hover/focus/Escape、disabled reason、locale、overflow command、focus restoration。
- `StudioLeftPanel`/`DesignerPalette`：单一搜索、icon/fallback、完整名称、无 specimen、Enter/Space/Escape keyboard drag、pointer drag 与 readonly。
- `DesignerCanvas`：空状态 absolute/pointer-events 合同、projected candidate、Camera hint/state、现有 camera/drag/selection 单测。
- Theme contract：4.5:1/3:1 的实际 token 配对、focus ring、reduced motion、Runtime 规则隔离。
- Playwright：两套 Provider 的真实 candidate/ghost/committed/Preview、空 Page、theme fingerprint、tooltip keyboard、900/390 topbar geometry、Camera 与 node toolbar bounding box、axe 和截图矩阵。

## 3. 质量命令

```powershell
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @moluoxixi/config-form-designer build
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench test:e2e
pnpm test:config-form-packages
pnpm lint
git diff --check
```

`@config-form/workbench build` 必须继续通过 `verify-element-plus-bundle.mjs`；不得用全量 Element Plus import 绕过按需导入门禁。

## 4. 高风险文件与止损点

- `packages/ConfigForm/workbench/src/app/WorkbenchShell.vue`、`WorkbenchTopbar.vue`：命令接线与 responsive projection；出现重复 emit/重复状态即回滚 Topbar 批次。
- `packages/ConfigForm/workbench/src/studio/StudioLeftPanel.vue`：搜索和 Palette slot；出现双搜索或 drag command 变化即回滚 Palette shell 批次。
- `packages/ConfigForm/designer/src/components/DesignerPalette.vue`：公共组件兼容；保留 optional props，不以恢复 Runtime specimen 解决兼容问题。
- `packages/ConfigForm/designer/src/components/DesignerCanvas.vue` 与 `styles.scss`：geometry/hit-test 高风险；rect 偏差超过 1px、drop index 改变或 node toolbar 被遮挡即回滚 Empty/Camera 批次。
- `packages/ConfigForm/workbench/src/styles/*.css`：token 和断点；不使用 `!important` 掩盖 DOM/所有权错误，不向 RuntimeHost selector 扩散。
- Playwright screenshot 基线：只接受由明确需求导致的局部差异；禁止无审阅整批更新。

## 5. 启动前复核

- PRD 中 R1-R7 均映射到 AC1-AC7，无阻塞问题。
- `design.md` 明确 Workbench/Designer/Runtime 所有权和 Tooltip 单向依赖。
- `implement.jsonl`、`check.jsonl` 均为真实 spec 条目，无 `_example` 占位。
- 本轮只完成规划，不运行 `task.py start`；等待用户对最终规划摘要的后续明确批准。
