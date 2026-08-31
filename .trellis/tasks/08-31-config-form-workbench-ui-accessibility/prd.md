# ConfigForm Workbench 视觉与可访问性交互

## 目标与用户价值

提升 Workbench 的信息密度、可发现性和视觉层级，让高频操作在 Light/Dark 和不同视口下都清晰、稳定、易理解，同时保持 Canvas 为视觉中心。

## 已确认事实

- 工具按钮已有 `aria-label` 与原生 `title`，但提示不统一、不包含快捷键，也缺少统一延时、定位和触屏策略。
- 左侧物料当前把真实 Runtime specimen 压缩进窄列表，单选/复选文字过小，卡片等物料容易截断；同时已经具备 Registry icon 与 display name。
- Canvas camera 已支持 zoom、fit、100% 和快捷键，当前控件悬浮在画布下方居中，位置与三栏工具布局不协调。
- Palette item 为透明背景并嵌入白色 specimen，浅色主题区分度不足。
- 空物料搜索已有 empty state，但空 Page Canvas 缺少稳定的添加引导。
- 保存 revision 文案由持久性子任务负责，本任务只定义其视觉槽位和不换行约束。

## 需求

- 建立共享 Tooltip primitive，覆盖撤销、重做、复制、删除、viewport、camera、panel、Preview、Flow、Export 等图标按钮；文本包含命令名称和有效快捷键。
- tooltip 支持 keyboard focus、hover、Escape、reduced motion、viewport collision 和中英文，不以 `title` 作为唯一反馈。
- Palette hard cut 为“Registry icon + component displayName”的紧凑列表，不再在列表中渲染真实 Runtime specimen；点击添加和拖拽 ghost 继续使用原有 Registry/candidate/runtime 链路。
- 空 Page Canvas 显示清晰虚线引导“拖拽或点击左侧组件添加字段”，但引导不参与 Runtime layout、hit-test 或导出。
- camera 控件移到 Canvas 右下角或并入 Canvas toolbar；在三栏、侧栏折叠和 Preview 打开时保持固定、可达且不遮挡节点工具栏。
- Light 主题通过边界、hover/focus、层级和控件对比度区分 panel、palette item、Canvas frame；Dark 主题复用 token，不改变 Runtime viewport 背景。
- 所有顶栏菜单、状态和按钮在 900/390 下不换行，必要时进入标准 overflow menu。

## 验收标准

- [ ] 所有纯图标命令在 hover/focus 时出现本地化 tooltip，Undo 等显示真实快捷键，disabled 状态仍可解释原因。
- [ ] Palette 只呈现 icon + name；长名称不截断关键文本，完整名称可访问，拖拽 candidate/ghost 与 drop 后仍为真实组件渲染。
- [ ] 空画布引导可见但不会改变 Runtime DOM 几何、drop index、Export 或 Preview。
- [ ] camera 控件在 1440/900/390 与左右栏开合时不漂移、不遮挡，50%/100%/fit 状态可辨认。
- [ ] Light/Dark 普通文本达到 4.5:1，边界/焦点/图标达到 3:1；Canvas Runtime 在主题切换前后 computed style 不变。
- [ ] axe、键盘导航、视觉回归、主题 contract、Playwright 和 typecheck 通过。

## 范围外

- 不在 Palette 重新引入缩小的真实组件预览。
- 不修改 ConfigForm Runtime 组件自身主题或业务样式。
- 不在本任务实现 autosave、Preview 表单测试台或 Inspector schema 逻辑。
