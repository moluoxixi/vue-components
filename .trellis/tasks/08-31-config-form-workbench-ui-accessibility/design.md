# ConfigForm Workbench 视觉与可访问性交互设计

## 1. 设计原则

本任务只调整“命令如何被发现与呈现”，不调整“命令如何改变项目”。ProjectEditorSession、Designer command bridge、History、RuntimeHost 和 Registry 继续是各自状态与行为的唯一所有者。

三个不可破坏的约束：

1. Workbench chrome 可以使用 Element Plus；Designer 核心保持 UI 库无关。
2. Palette、空状态和 Camera 都属于 Designer presentation，不能进入 Runtime iframe 或导出模型。
3. 响应式只改变命令呈现优先级，不改变 emit、Project Command 或 Runtime geometry。

## 2. 所有权与边界

| 区域 | 所有者 | 本任务允许的变化 | 禁止变化 |
| --- | --- | --- | --- |
| Tooltip/Overflow 浮层 | Workbench | Element Plus Tooltip/Dropdown、overlay root、焦点与响应式呈现 | Designer/Runtime 引入 Element Plus |
| 命令元数据 | 命令渲染组件 | locale label、shortcut、disabled reason、中性 DOM 标记 | 新业务状态或第二套 command dispatcher |
| Palette | Designer Registry presentation | icon/name、搜索呈现、drag/click 可访问性 | Runtime specimen、独立组件模型 |
| Empty Canvas | Designer Canvas overlay | 可见引导和无障碍文案 | Runtime DOM、sheet geometry、drop/selection 逻辑 |
| Camera | Designer Canvas | 控件位置、提示、safe inset | scale、pan、fit、geometry 算法 |
| Theme/Responsive | Workbench + Designer styles | 语义 token、focus、overflow、reduced motion | RuntimeHost/Provider 主题注入 |

`WorkbenchShell` 继续只编排现有 context 和 emit。任何 UI 重排都不得直接编译、写 ProjectDocument 或维护 command 可用性的第二份派生状态。

## 3. 统一命令提示合同

### 3.1 中性命令元数据

纯图标 trigger 统一提供以下 presentation 元数据：

- 可访问名称：现有 `aria-label`；
- 快捷键：存在真实 handler 时使用 `aria-keyshortcuts` 和同源显示值；
- 不可用原因：只有 disabled 时提供本地化 reason；
- 显式 opt-in 标记：区分 icon command 与普通带文字控件。

名称和 shortcut 不在 Tooltip 内另建常量表，避免 visible label、ARIA 和 handler 漂移。Designer 组件只输出中性 DOM 元数据，仍可在独立使用时保留原生 `title` fallback。

### 3.2 Workbench Tooltip Host

Workbench 增加一个领域命名的命令提示宿主，使用 Element Plus `ElTooltip` 的 virtual trigger 能力：

1. 在 `.workbench-app` 与 `#workbench-overlays` 内委托处理 `pointerover/out`、`focusin/out` 和 `Escape`，覆盖父文档及 Teleport 命令；
2. 从当前 trigger 的 ARIA/命令元数据组合“命令名称 + 快捷键/不可用原因”；
3. 通过非 DOM `Measurable` 代理读取当前 trigger 的矩形，避免 Element Plus virtual trigger 覆盖命令自身的 `aria-controls` / `aria-expanded`，并统一 Teleport 到 `#workbench-overlays`，使用 collision placement、延时和 `workbench-passive-tooltip`；
4. coarse pointer 不维持 hover tooltip，keyboard focus 仍可获得说明；
5. disabled icon command 保留可聚焦的原生 button，使用 `aria-disabled="true"` 和本地化 reason；click/keyboard handler 在领域状态入口继续阻止命令执行。

这样可覆盖 Workbench 自有按钮和嵌入的 Designer Canvas 命令，同时不把 Element Plus 倒灌进公共 Designer 包。若现有局部 `ElTooltip` 已满足合同，应迁移到同一宿主，避免重复浮层和配置漂移；不创建 `BaseButton` 或第二套 UI 框架。

## 4. Palette 数据与交互

`DesignerPalette` 继续拥有 Registry material 分组、click add、pointer drag 和 keyboard drag，只删除展示层的 `DesignerMaterialSpecimen`。每行由以下内容组成：

```text
Registry material -> localized category -> icon/fallback + localized displayName
                  -> existing add/drag source -> candidate command -> real Runtime
```

- `registry`/`form` 输入在本轮保留源兼容，但不再用于 Palette render，避免公共组件调用方立即破坏；后续若要删除必须单独走 API 兼容任务。
- Palette 增加明确的 search presentation 开关：通用 Designer 默认保留内部搜索，Workbench 使用 `StudioLeftPanel` 的 `ElInput` 并关闭内部搜索，确保一个视图只有一个搜索框。
- 长名称使用可换行的稳定行高；button 的 accessible name 始终是完整 display name。
- drag overlay、candidate preview、committed node 和 Preview 不复用 Palette DOM，现有真实 Provider Runtime 路径保持不变。

## 5. Empty Canvas Overlay

空状态判断使用当前 projected graph 的可见根节点，而不是依赖 Provider renderer field 数量；active candidate 出现时隐藏引导。

引导和 runtime slot 是 `.canvas-sheet` 内的 sibling，但引导采用 absolute overlay：

- `position: absolute` 与明确 inset；
- `pointer-events: none`，不注册 editor/drop 标记；
- 不提供最小高度，不参与 ResizeObserver 的内容尺寸；
- 不进入 RuntimeHost iframe、Preview 或 export source/config；
- 文案由 Designer locale catalog 提供，并通过稳定 id/`aria-describedby` 成为 Canvas 的空状态描述，避免无关联的视觉提示或重复 live announcement。

单测验证 DOM/样式合同；E2E 通过新空 Page 比较引导出现前后的 sheet/runtime rect、drop 结果和 Export/Preview 输出。

## 6. Camera 布局

Camera 控件保持在 `DesignerCanvas`，从底部居中改为右下角固定 safe inset：

- 桌面/900px：右、下均使用稳定 token 间距；
- 390px：考虑底部 mobile dock 和 safe-area，使用 responsive inset；
- viewport 增加与 Camera 尺寸匹配的滚动安全区，使可操作内容能够滚出浮层遮挡区；
- 控件宽高固定，百分比使用 tabular numerals，状态变化不引发布局位移；
- Zoom out/in、100%、Fit 使用统一 command hint，显示 `-`、`+`、`0`、`Shift+1`；上下限 reason 明确。

Camera 仍是 Canvas sibling overlay，不随 sheet scale 变换。E2E 对 Camera、Canvas、node toolbar 和 viewport 做 bounding-box 不相交断言，并复跑现有 intrinsic frame、zoom、pan、fit 回归。

## 7. Responsive Topbar

顶栏采用明确的 action priority，而不是仅靠 CSS 隐藏：

1. 宽屏显示 workspace context、revision/status 和主命令；
2. 900px 将 status 与低优先级命令投影到 More actions；
3. 390px 只保留按产品路径优先级选出的 Save、Preview、Export 与 More actions，其余命令进入同一个 Element Plus Dropdown；
4. visible/overflow 都调用原有 emit，Dropdown 只拥有展开、键盘和焦点状态。

顶栏 grid tracks 使用 `minmax(0, ...)`、固定 action 尺寸和 `white-space: nowrap`。workspace 文本允许在自己的格内截断，但完整项目/页面名称保留可访问名称；status 在 overflow 内仍以 `role="status"` 可读。测试直接断言 header 子项不换行、互不相交且 `documentElement.scrollWidth === clientWidth`。

## 8. Theme 与 Reduced Motion

- 扩展现有语义 token 对比度矩阵，覆盖 panel、elevated surface、Canvas workspace、hover/selected、icon、border 和 focus ring 的实际配对。
- focus ring 使用不低于 3:1 的实色/混合结果；不能只验证 token 存在。
- reduced-motion 关闭 Tooltip、Palette、Camera、focus/selection 的非必要 transition；不改变 loading 或状态语义。
- Runtime 主题隔离使用浏览器 computed-style 指纹验证，两套 Provider 分别采样 Design 和 Preview 的代表性 input、label、border、background、font/color，切换 Workbench theme 前后应完全一致。

## 9. 兼容与回滚

- 保留既有 `aria-label`、`aria-keyshortcuts`、`data-*`、emit 和 keyboard handlers；新增 DOM 标记仅用于 presentation/test，不进入模型。
- 保留 `DesignerPalette` 的现有 optional props 以降低公共 API 破坏；若 no-unused/typecheck 需要调整，在不恢复 specimen 的前提下做兼容处理。
- 每一批先加失败测试再改实现。Tooltip host、Palette、Empty/Camera、Topbar/Theme 是独立回滚点；任一批出现 Runtime geometry 超过 1px、Provider 样式变化或命令不可达时，回滚该批而不是放宽断言。
- 只有新增公共 Designer API、依赖或跨包能力时才同步 `packages/ConfigForm/README.md`；纯内部 presentation 变化不制造架构文档噪声。
