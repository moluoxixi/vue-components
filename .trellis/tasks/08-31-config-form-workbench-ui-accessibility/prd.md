# ConfigForm Workbench 视觉与可访问性交互

## 目标与用户价值

在不改变 Config Model、Project Command、RuntimeHost 或 Provider Runtime 的前提下，完成 Workbench 高频命令、物料区、空画布、Camera、响应式顶栏和 Light/Dark 视觉层级的生产级收口。用户在鼠标、键盘、触屏和 1440/900/390 视口下都应能发现、理解并稳定执行操作，Canvas 始终是视觉与交互中心。

## 已确认事实

- Workbench 顶栏和左侧标签已经使用 Element Plus `ElTooltip`、`ElDropdown`、`ElTabs` 等组件，并统一 Teleport 到 `#workbench-overlays`；本任务基于该组件化基础补缺，不重复迁移通用外壳。
- `DesignerPalette` 当前同时渲染 Registry icon、display name 和 `DesignerMaterialSpecimen`（`packages/ConfigForm/designer/src/components/DesignerPalette.vue:260`），而 Workbench 又在 `StudioLeftPanel` 提供一层 Element Plus 搜索；Palette 的展示与搜索职责尚未收口。
- 空画布提示当前位于 `.mx-config-form-designer__canvas-sheet` 的普通布局流中（`packages/ConfigForm/designer/src/components/DesignerCanvas.vue:1535`），样式具有 `min-height: 104px`（`packages/ConfigForm/designer/src/styles.scss:755`），因此不能证明提示对 sheet 测量和 Runtime geometry 零影响。
- Camera 已有 Zoom out、100%、Zoom in、Fit 和 `-`、`0`、`+`、`Shift+1` 快捷键，但控件固定在 Canvas 底部中央（`packages/ConfigForm/designer/src/styles.scss:509`），仅依赖原生 `title` 解释快捷键。
- 900px 下现有样式隐藏 revision 状态，700px 下启用 More actions，390px 下缩小按钮；现有测试未建立“顶栏不换行、无横向溢出、所有隐藏命令仍可达”的几何合同。
- 现有 `theme-contract.test.ts` 已检查一组 Light/Dark token 对比度和 Runtime token 隔离，axe E2E 已覆盖桌面双主题及 390px Inspector/辅助工作区；尚缺完整命令 tooltip、空画布、顶栏几何、Runtime computed-style 指纹和稳定截图回归。
- `@moluoxixi/config-form-designer` 是 UI 库无关的公共包，不依赖 Element Plus；Element Plus 只属于 Workbench chrome，不能倒灌到 Designer 或 RuntimeHost。

## 需求

### R1 统一命令提示与键盘反馈

- 对 Workbench 内所有纯图标命令建立统一可见提示合同，覆盖顶栏、Designer toolbar、侧栏开关、viewport、Canvas interactive、Camera、节点工具栏、拖拽/复制/删除和 More actions。
- 提示文本使用当前 locale 的命令名称；存在有效快捷键时显示真实快捷键，不声明未接线的快捷键。
- 支持 hover、keyboard focus、`Escape` 关闭、viewport collision、稳定延时和 `prefers-reduced-motion`；触屏不产生悬停残留或阻塞点击。
- `aria-label`、`aria-keyshortcuts` 和可见 tooltip 各自保持语义一致；不能把原生 `title` 当作 Workbench 内唯一反馈。
- disabled 命令仍可获得焦点说明不可用原因，例如“没有可撤销操作”“请先选择组件”或“已达到最小缩放”。

### R2 Palette 高密度展示

- 每个 Palette item 只展示 Registry icon（无 icon 时使用稳定 fallback）和本地化 display name；保留分类、点击添加、pointer drag 和 keyboard drag。
- Workbench 只显示一套搜索输入；长名称允许安全换行且完整名称可访问，不使用会丢失关键信息的单行截断。
- Palette 不渲染真实 Runtime specimen；Canvas candidate、drag ghost、drop 后节点和 Preview 继续走现有 Registry、Canonical IR 和 Provider Runtime 链路。

### R3 零侵入空画布引导

- 空 Page Canvas 显示本地化引导“拖拽或点击左侧组件添加字段”，并在开始 candidate 操作后退出干扰状态。
- 引导是 Designer overlay，不参与 Runtime DOM、sheet 高度计算、geometry bridge、drop target/index、selection hit-test、Preview 或 Export。
- 引导不拦截 pointer、keyboard 或 touch；Canvas 通过可访问描述关联完整引导文案，screen reader 不依赖视觉位置理解空状态。

### R4 稳定 Camera 区域

- Camera 固定在 Canvas 右下角，保留 Zoom out、100%、Zoom in、Fit 和现有快捷键，不改变 intrinsic frame、scale、pan 或 geometry 算法。
- 在 1440/900/390、左右栏开合、Preview 开关和页面可滚动状态下，Camera 不漂移、不越界、不遮挡节点 toolbar 或可操作内容。
- 50%/100%/Fit 等状态保持可辨认，disabled 上下限有明确原因提示。

### R5 Light/Dark 对比度与 Runtime 隔离

- Workbench/Designer chrome 的普通文本与实际背景对比度不低于 4.5:1；控件边界、图标、选中状态和 focus indicator 不低于 3:1。
- Light 主题通过语义边界、hover/focus、层级和 Canvas frame 区分区域；Dark 主题复用同一语义 token 角色，不用额外单色覆盖。
- Workbench 主题切换不得改变 Design/Preview iframe 内代表性 Runtime 节点的 computed style 指纹，也不得向 RuntimeHost 注入 Workbench token。

### R6 响应式顶栏与标准 Overflow

- 顶栏 brand、workspace context、status 和 action 区在 900px 与 390px 下不换行、不互相覆盖、不造成页面横向滚动。
- 当空间不足时，低优先级命令和 revision/status 信息进入 Element Plus 标准 More actions overflow；命令只保留一个行为入口和同一 emit 语义，不复制业务状态机。
- overflow 支持键盘导航、`Escape`、焦点恢复、中英文长文本和 disabled 说明；关键 Save、Preview、Export 入口按视口优先级保持可达。

### R7 验证与回归证据

- 新增或强化 Designer/Workbench 组件测试，覆盖命令清单、tooltip 状态、disabled 原因、Palette、空画布、Camera 和 responsive overflow。
- Playwright 覆盖 keyboard-only 主路径、axe、1440/900/390、Light/Dark、zh-CN/en-US、Provider Runtime 恒等性和视觉截图。
- Designer 与 Workbench 的 test、typecheck、build、Element Plus bundle guard、lint 和 diff-check 全部通过。

## 验收标准

- [ ] AC1：R1 列出的每个纯图标命令在 hover/focus 时显示本地化 tooltip；快捷键与实际 handler 一致，`Escape` 可关闭，disabled 状态可聚焦并解释原因，reduced-motion 与触屏行为通过自动化验证。
- [ ] AC2：Palette item DOM 只含 icon/fallback 与完整 display name，不含 `DesignerMaterialSpecimen` 或 Provider control；点击、pointer drag、keyboard drag、candidate/ghost、drop 后和 Preview 行为保持通过。
- [ ] AC3：空 Page 显示引导；引导前后 sheet/runtime 几何、drop index、Preview 与 Config/Source Export 均无差异，且引导层 `pointer-events: none`。
- [ ] AC4：Camera 在 1440/900/390、两侧栏组合与 Preview 状态下保持 Canvas 右下角安全内距，和节点 toolbar/viewport 边界无相交；缩放、Fit、100%、pan 与快捷键回归通过。
- [ ] AC5：Light/Dark 实际 token 组合满足 4.5:1/3:1 门槛；主题切换前后两套 Provider 的 Design/Preview Runtime computed-style 指纹不变。
- [ ] AC6：900/390、zh-CN/en-US 下顶栏元素无换行、遮挡或 document 横向溢出；移入 overflow 的命令和状态仍可由键盘访问并恢复焦点。
- [ ] AC7：axe 在桌面双主题、900px 和 390px 关键状态均无 WCAG 2 A/AA 新增问题；视觉回归矩阵、单测、Playwright、typecheck、build、bundle guard、lint 与 `git diff --check` 全绿。

## 范围外

- 不修改 Config Model、ProjectDocument、Project Command、History、RuntimeHost protocol 或 Provider Runtime 业务样式。
- 不在 Palette 恢复任何缩小 Runtime specimen，也不增加 hover preview。
- 不改变 Camera 的 scale/pan/geometry 算法，不新增任意缩放输入、mini-map 或画布持久化视角。
- 不实现 Inspector schema、自适应属性、模板管理、JSON 导入、autosave、Preview testbench 或持久化版本能力。
- 不把 Element Plus 添加为 Designer、Core、Runtime 或 Provider 包的依赖。
