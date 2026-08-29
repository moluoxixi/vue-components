# 生产级可视化编辑器模式调研

## 调研对象与证据

### GrapesJS / GrapesJS Studio

- Canvas 通过 Component Model + Component View 渲染真实组件；View 可以增加编辑态交互，但这些按钮、选区和行为不会进入最终导出。
- Canvas Spots 是独立的 overlay，用于 select、target 等反馈。target spot 会随着组件 DOM 和滚动重新定位，而不是修改组件本身的布局。
- Canvas 通常运行在隔离 frame 中，模型与视图通过事件同步；组件脚本只在 frame 内执行。
- Canvas API 提供 drag lifecycle 和显式 `startDrag`，目标高亮不依赖列表 DOM 的偶然顺序。

参考：

- <https://github.com/grapesjs/grapesjs/blob/dev/docs/modules/Components.md>
- <https://github.com/grapesjs/grapesjs/blob/dev/docs/modules/Canvas.md>
- <https://github.com/grapesjs/grapesjs/blob/dev/docs/api/canvas.md>

### Craft.js

- `connect` 将真实 DOM 注册为节点表示，`drag` 只绑定到可拖拽句柄；Canvas 节点同时是可投放区域。
- 节点树保存 selected、hovered、dragged 状态，`canDrop` 在提交前校验父子关系。
- 编辑器状态序列化为节点树 JSON，DOM 只是投影；同一组件的嵌套 DOM 不需要额外的静态缩略图。

参考：

- <https://github.com/prevwong/craft.js/blob/main/site/docs/concepts/user-components.md>
- <https://github.com/prevwong/craft.js/blob/main/site/docs/api/NodeHelpers.md>
- <https://github.com/prevwong/craft.js/blob/main/site/docs/guides/save-load.md>

### Plasmic

- Studio 将 top frame（编辑器）与 host frame（真实组件运行环境）分开；host frame 通过协议注册组件并使用自己的 memory history 渲染。
- 这种分层隔离 CSS、组件副作用和编辑器 chrome，同时保持编辑器与真实组件树使用同一份组件注册信息。

参考：

- <https://github.com/plasmicapp/plasmic/blob/master/platform/wab/src/wab/client/frame-ctx/README.md>

### Builder.io

- 组件通过注册表提供 `inputs`、`defaultChildren`、`canHaveChildren`、`childRequirements`、`defaultStyles` 等契约；编辑器和 Runtime 消费同一注册结果。
- 组件可以在 visual editor 和最终 Runtime 中复用，组件输入 schema 同时驱动属性面板和拖拽约束。

参考：

- <https://github.com/builderio/builder/blob/main/packages/core/docs/interfaces/Component.md>
- <https://github.com/builderio/builder/blob/main/packages/react/README.md>

### Pragmatic Drag and Drop

- 提供 `onGenerateDragPreview`、`onDragStart`、`onDrag`、`onDropTargetChange`、`onDrop` 完整生命周期，支持 nested draggable/drop target。
- `canDrop()` 负责目标能力判断；sticky target 避免指针短暂离开子目标时出现跳闪。
- 采用 monitor 观察拖拽，而不是让库自动重排业务数组；适合“候选模型 + 自定义投放指示器”架构。

参考：

- <https://github.com/atlassian/pragmatic-drag-and-drop/tree/main/packages/documentation/constellation/05-core-package>

### Vue Flow

- 自定义节点/边只负责画布投影；连接可通过 `isValidConnection` 或 `onConnect` 预校验。
- 生产场景应使用 controlled flow（`applyDefault=false`），在 `onNodesChange` 中验证后再应用变化；这样 Vue Flow 不会绕过业务 Model 直接修改状态。

参考：

- <https://github.com/bcakmakoglu/vue-flow/blob/master/docs/src/guide/controlled-flow.md>
- <https://github.com/bcakmakoglu/vue-flow/blob/master/docs/src/examples/dnd.md>
- <https://github.com/bcakmakoglu/vue-flow/blob/master/docs/src/examples/edges/validation.md>

## 跨产品共性

1. **真实组件树是唯一视觉依据**：编辑态只增加 selection、target、toolbar 等 overlay，不再维护“Palette 预览树”和“Canvas 静态卡片”两份渲染逻辑。
2. **拖拽过程是候选状态**：拖动过程中先计算 candidate model 和 target，不提交业务 Model；drop 时一次性提交 operation。
3. **编辑器状态与业务状态分离**：hover、dragged、selection、坐标和 pointer history 不进入业务模型；位置若需保存也只作为展示元数据。
4. **容器能力由注册表声明**：`canHaveChildren`、slot/child rules、default children 和 inputs 同时驱动 Palette、Inspector、Runtime 与 drop validation。
5. **画布反馈是独立层**：target indicator、selection bounds、drop line 不通过改变组件背景或插入占位 DOM 来实现。
6. **复杂组件需要隔离策略**：同文档渲染适合纯 UI；全局 CSS、脚本和网络副作用多时使用 host frame/iframe 或 design-safe adapter。

## 对当前实现的诊断

`DesignerPalette.vue:23-88,182-217` 通过 `DesignerNodePreview` 单独渲染 material，并对 container slot 使用 fallback；`DesignerNodeList.vue:218-255,464-499` 依赖 SortableJS 的 DOM clone/ghost，再在 `onAdd`/`onEnd` 时提交 Model；Runtime 的真实递归入口位于 `ConfigFormRenderer.vue:190-237,240-377`。因此：

- Palette 预览没有父级 layout、slot 上下文和当前 responsive width；
- Sortable ghost 的尺寸和组件最终插入后的尺寸可能不同；
- nested list 的 pointer target 依赖 DOM closest，深层嵌套时父列表与子列表竞争；
- Canvas 的 `DesignerNodePreview` 与 Runtime `ConfigFormRenderer` 不是同一个渲染入口；
- 拖拽中实际 DOM 已经变化，但 Preview 仍读取旧 Model，导致拖拽动画与最终渲染错位。

本地浏览器实测（`http://127.0.0.1:4313/designer.html`）也印证了这一点：Canvas 节点在当前 viewport 下会得到完整的 grid/Flex 宽度，而 Palette drag preview 的 bounding box 为 `0×0`（它位于隐藏的 palette clone 中），容器物料仍显示 `Content` fallback；这不是视觉细节问题，而是预览没有进入目标父级 Runtime layout。

## 采用结论

- 保留 Vue 3 + ConfigForm Runtime，不引入 GrapesJS/Craft.js 作为业务模型。
- 用 `RuntimeSurface` 作为 Design Canvas 和 Preview 的共同渲染入口；编辑态只注入 node metadata 和 overlay。
- 将 SortableJS 的业务重排职责替换为低层 pointer/drag adapter（优先评估 Pragmatic Drag and Drop），由 `DropTargetResolver` 计算最深可接受 slot 和 before/after indicator。
- Palette 与 Canvas 拖拽都渲染 candidate model 的真实组件；不再渲染静态 summary 或 slot fallback 作为最终反馈。
- 高副作用/全局样式组件可声明 `designPolicy` 并在 RuntimeSurface 中使用受控 sandbox，但不得悄悄换成与最终组件无关的占位图。
