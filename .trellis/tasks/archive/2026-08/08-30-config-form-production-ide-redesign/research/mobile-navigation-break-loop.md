# 移动端工作区状态与弹窗焦点复盘

## 1. 根因类别

- **B - 跨层契约**：Workbench 底部导航是窄屏视图所有者，但 `DesignSurface` 的断点 watcher 又根据中屏抽屉和焦点重算 `activeWorkspaceView`，造成两个状态源。
- **D - 测试覆盖缺口**：已有测试覆盖内部导航的断点焦点迁移，没有覆盖 `workspaceNavigation="external"` 下从中屏 Inspector 缩到窄屏的路径。
- **E - 隐式假设**：Workbench 开发服务按包 `import` 条件读取 Designer `dist`。源码测试通过后若未重建 Designer，浏览器仍会运行旧产物。

## 2. 先前修复为何看似失败

1. 早期样式调整只改变可见性，未解决 Workbench 与 Designer 的状态所有权冲突。
2. 本次 watcher 修复先通过组件测试，但浏览器首次复测仍显示旧行为；原因是 Workbench 服务加载了修复前的 Designer `dist`。
3. 重建 Designer 并刷新后，同一路径稳定通过，证明修复点与运行产物都需要纳入验收流程。

## 3. 预防机制

| 优先级 | 机制 | 具体动作 | 状态 |
| --- | --- | --- | --- |
| P0 | 架构 | external navigation 下由宿主唯一控制窄屏 active view | DONE |
| P0 | 测试 | 增加 medium Properties -> narrow Canvas 的外部导航回归 | DONE |
| P0 | 浏览器验收 | 同时断言底部 selected tab、Designer active view 和 visible panel | DONE |
| P1 | 焦点契约 | 临时菜单打开弹窗前同步聚焦稳定触发器 | DONE |
| P1 | 构建流程 | 改 Designer 源码后先 build，再复测加载其 dist 的 Workbench | DONE |

## 4. 系统性扩展

- Preview、Export、Flow、Page Manager 同样必须只有一个 open/selection owner。
- 任何 `v-if` 菜单项都不能作为 dialog return-focus 目标。
- 浏览器验收必须确认实际包入口，不能把源码单测结果等同于运行服务已加载新代码。

## 5. 知识沉淀

- 已更新 Designer quality spec 的 RuntimeSurface drag 与 external navigation 契约。
- 已更新 Workbench quality spec 的 ephemeral menu dialog focus 契约。
- 已增加组件回归并完成 390px 浏览器路径验证。
