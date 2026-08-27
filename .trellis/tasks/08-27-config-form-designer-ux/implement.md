# 配置化表单设计器功能与界面优化实施计划

## 实施清单

1. [ ] 为 Designer 根容器补充 ResizeObserver 测量测试，建立 desktop / medium / narrow 私有状态与模式转换。
2. [ ] 将默认 palette、canvas、properties 与 slot scope 接入统一 `addMaterial` / `selectNode` 导航包装，保持 controller 写入路径不变。
3. [ ] 重构工作区 DOM/CSS：桌面三栏、中宽互斥侧滑、窄屏三视图，确保面板常驻、状态保留与单一滚动容器。
4. [ ] 建立工作台视觉 token，统一 toolbar、workspace tabs、drawer、panel、node action 和交互状态，保持 selection frame 与真实组件几何。
5. [ ] 实现无 UI 框架依赖的 focus boundary，并接入 transfer dialog、preview dialog 和 medium side panel 的初始焦点、循环、Escape 与恢复。
6. [ ] 完成 property/workspace tabs 的 ARIA 与 roving keyboard；为 toolbar 增加方向键模型；调整 node action DOM 顺序并保留结构编辑按键。
7. [ ] 删除 canvas 对 blur listener 的空覆盖，并增加事件透传回归测试。
8. [ ] 为 unsupported material 增加本地化占位与 material key，补齐 Element Plus / Ant Design Vue locale 和测试。
9. [ ] 在 Playground 为两套 adapter 注入共享 custom validator，覆盖 setter、导出和 Runtime Preview 行为。
10. [ ] 补齐非法导入、clipboard、download、宽父页面中的窄容器、状态保留和无横向溢出 E2E。
11. [ ] 建立 Chromium 三档视觉基线，新增 Firefox/WebKit 定向 smoke project 与场景。
12. [ ] 运行受影响包测试、类型检查、构建、公开包边界验证和完整浏览器矩阵，并人工复核桌面/中宽/窄屏截图。

## 预计改动范围

- `packages/ConfigForm/designer/src/components/ConfigFormDesigner.vue`
- `packages/ConfigForm/designer/src/components/DesignerPropertyPanel.vue`
- `packages/ConfigForm/designer/src/components/DesignerNodeList.vue`
- `packages/ConfigForm/designer/src/components/DesignerNodePreview.vue`
- `packages/ConfigForm/designer/src/composables/`
- `packages/ConfigForm/designer/src/styles.scss`
- `packages/ConfigForm/designer/__tests__/`
- `packages/ConfigForm/designer-element-plus/src/locale-messages.ts`
- `packages/ConfigForm/designer-antd-vue/src/materials.ts`
- 两套 adapter locale / material tests
- `packages/ConfigForm/playground/src/designer/DesignerExample.vue`
- `packages/ConfigForm/playground/e2e/config-form-playground.spec.ts`
- `packages/ConfigForm/playground/playwright.config.ts`
- Chromium screenshot baselines

## 验证命令

```powershell
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @moluoxixi/config-form-designer-element-plus test
pnpm --filter @moluoxixi/config-form-designer-element-plus typecheck
pnpm --filter @moluoxixi/config-form-designer-antd-vue test
pnpm --filter @moluoxixi/config-form-designer-antd-vue typecheck
pnpm --filter @config-form/playground typecheck
pnpm --filter @config-form/playground build
pnpm test:config-form-packages
pnpm --filter @config-form/playground test:e2e -- --project=chromium --grep "designer"
pnpm --filter @config-form/playground test:e2e -- --project=firefox --grep "designer smoke"
pnpm --filter @config-form/playground test:e2e -- --project=webkit --grep "designer smoke"
```

根据仓库并行任务状态，最后再运行 scoped ESLint；只有工作树不受其他任务阻塞时才将全仓 `pnpm lint`、`pnpm typecheck` 和 `pnpm test` 作为本任务闭环门槛。

## 风险门

- 不修改 `DesignerDocument` 版本、schema 或导出 JSON 形态。
- 不新增 Designer 对 Element Plus / Ant Design Vue 的直接依赖。
- 不将工作区 mode 与表单 preview breakpoint 合并。
- 不用 `v-if` 销毁窄屏隐藏面板；若第三方组件在 hidden 后不能恢复，先增加显式 refresh，不以重建整个 Designer 规避。
- 不在 canvas 内复制 Runtime touched、validation 和 error state。
- 不让视觉截图覆盖动态第三方 popup、日期、动画或系统字体差异区域。
- 不在本轮实现在线网站工作台、Source、模板库或 Page Preview。

## 回滚点

- 工作区状态与 CSS 可整体退回当前三栏/堆叠布局，文档与 compiler 不受影响。
- Focus boundary 与 roving keyboard 是独立 composable，可单独回滚而不改变鼠标路径。
- blur、custom validator 与 unsupported fallback 是三项独立修复，可分别回滚。
- Firefox/WebKit smoke 与 Chromium screenshot 项目只影响测试配置，可在不改变运行代码的前提下调整。
