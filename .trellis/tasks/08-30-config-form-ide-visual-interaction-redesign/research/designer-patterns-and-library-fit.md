# 成熟设计器模式与库适配调研

## 结论

本轮应借鉴成熟编辑器的交互模式，但不替换现有 Designer/Runtime 核心。当前实现已经具备真实 Runtime、Registry、Config Model、Operation、嵌套 drop、键盘拖拽和几何一致性测试；引入一个完整第三方页面编辑器会重新制造第二份组件模型，并破坏 Vue Runtime 与平台注册物料的边界。

## 候选方案

| 方案 | 当前版本 | 可借鉴点 | 不直接接入原因 |
| --- | --- | --- | --- |
| Craft.js | `@craftjs/core@0.2.12` | 把拖拽、节点状态、用户组件渲染和编辑器 UI 解耦；真实用户组件通过 connector 进入画布；状态可序列化 | React 专用；接入会与现有 Vue Registry、Config Model 和 Operation 重复 |
| GrapesJS | `grapesjs@0.23.6` | Blocks、Layer Manager、Style/Traits、Canvas 分区清晰；辅助管理器不与 Canvas 争夺主模式 | 自带 HTML/CSS Component Model 和 Storage；允许任意 DOM，与“只允许平台注册组件”冲突 |
| dnd-kit | `@dnd-kit/core@6.3.1` | DragOverlay、sensor、键盘和无障碍模式值得参考 | React 专用；现有拖拽控制器已经与 Model target、nested slot、candidate identity 深度整合 |
| Moveable | `moveable@0.53.0` / `vue3-moveable@0.28.0` | resize、group、snap 和 guideline 能力成熟 | 主要面向自由定位/transform；当前页面布局以 grid span 和容器 slot 为语义，直接接入会把语义 Resize 退化为像素变换 |
| Ali LowCode Designer | `@alilc/lowcode-designer@1.3.4` | 物料协议、Schema 驱动 Inspector、Designer shell 与 simulator 分层 | React 生态且拥有完整引擎模型；适合参考边界，不适合嵌入当前 Vue 架构 |
| Vue Flow | `@vue-flow/core@1.48.2`（仓库现有） | 节点/连线、pan/zoom、selection 适合流程图 | 只适用于 Flow workspace；不应拿流程图坐标模型替换页面的 Registry Runtime |

版本和描述通过 2026-08-30 的 npm registry 元数据核对。

## 官方资料

- Craft.js: https://craft.js.org/docs/overview/
- Craft.js nodes: https://craft.js.org/docs/concepts/nodes
- GrapesJS: https://grapesjs.com/docs/
- GrapesJS Blocks: https://grapesjs.com/docs/modules/Blocks
- GrapesJS Traits: https://grapesjs.com/docs/modules/Traits
- dnd-kit DragOverlay: https://docs.dndkit.com/api-documentation/draggable/drag-overlay
- Moveable: https://daybrush.com/moveable/
- Ali LowCode Engine: https://github.com/alibaba/lowcode-engine
- Vue Flow: https://vueflow.dev/

## 可直接采用的产品模式

### 1. Editor connector，而不是第二套组件

Craft.js 的核心启发不是 React API，而是 connector 思路：真实用户组件负责渲染，编辑器只附加选择、拖拽和操作能力。当前项目的 Runtime surface + editor overlay 已经符合这一方向，应继续强化，不应再创建 Designer 专用控件。

### 2. Canvas、Panel Manager、Inspector 分层

GrapesJS 把 Blocks、Layers、Traits 和 Canvas 分成明确管理器。对本项目的对应关系是：

- Components = Registry 物料发现
- Layers = Config Model 结构投影
- Inspector = Registry Schema setter
- Canvas = Runtime + editor overlay
- Pages / Flow / Export = 辅助 workspace

这支持重做 UI 组合，而不要求替换核心状态流。

### 3. DragOverlay 必须来自最终 Runtime 几何

dnd-kit 的 DragOverlay 强调视觉副本与可拖元素生命周期分离。本项目更严格：overlay 的尺寸必须来自画布中真实 candidate 的 bounding box，candidate 与 commit 还必须共享同一 Registry node identity。现有 E2E 已验证这一点，应保留实现，只调整透明度、边框和层级。

### 4. Resize 必须遵循页面布局语义

Moveable 的自由 resize 很成熟，但 ConfigForm 的 resize 代表 grid span，而非元素 `width/height`。本轮只优化 handle、反馈和键盘路径；若未来引入 Moveable，也只能作为 overlay 几何工具，不能让它直接写 DOM transform。

### 5. 辅助工作区保持 modal / overlay

现代设计器通常把代码、页面管理、流程等低频复杂能力放入独立 workspace。当前 Source/Config、Flow、Page Manager 的产品位置合理；本轮统一它们的 shell、文件树、标题栏和响应式即可。

## 本轮依赖决策建议

- 不新增完整页面编辑器依赖。
- 不替换现有 drag controller。
- 保留 Vue Flow 仅服务流程编排。
- 不引入 Moveable，除非实现阶段发现现有 selection/resize overlay 无法满足已确认的验收标准；若发生，应回到设计评审而不是直接添加依赖。

