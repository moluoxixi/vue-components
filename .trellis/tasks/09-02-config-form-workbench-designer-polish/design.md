# ConfigForm Workbench 设计器视觉精修技术设计

## 1. 所有权与边界

本子任务以 Workbench 壳层和现有 Designer 扩展点为边界：

- `packages/ConfigForm/workbench/src/app/index.vue` 保持设计器编排与四区插槽接线。
- `WorkbenchTopbar.vue`、移动 dock 和 Workbench 样式拥有命令呈现与响应式可发现性。
- `packages/ConfigForm/designer` 保持领域状态、selection、drag、camera、geometry 和 UI 库无关合同。
- 简单属性控件继续通过 `DesignerPropertyControlRegistry` 投影到真实 ConfigForm Renderer；Element Plus/Ant Design Vue 组件由对应 designer adapter 注册。不得把 Element Plus import 加到 Designer 核心。
- Design RuntimeHost iframe 和父文档 geometry bridge 不改协议、不改测量算法。

## 2. 视觉层级

### 2.1 排版

- 常规控件与正文使用 12–13 像素，面板标题使用 12–13 像素并以字重/颜色区分，不使用 viewport 缩放字号。
- 原 9 像素导航、meta、badge 提升到至少 11 像素；非必要全大写不作为层级手段。
- 所有 Workbench 字距为 0，行高和固定控件高度在 hover、loading、label 变化时不引发布局跳动。

### 2.2 表面与边界

- 四区仍为顶栏、左侧工作区、中央 Canvas、右侧 Inspector/辅助面板；Canvas 保持最大可用区域。
- 面板使用共享 workspace/panel/control/line token 区分，不把每个 section 包成浮卡，也不嵌套卡片。
- 选中、hover、drop candidate、focus、warning/error 分别使用主题 semantic token，不只依赖色相区分。
- 不使用装饰渐变、背景光斑或营销式留白。

## 3. Canvas Framing

Dark 壳层与固定浅色 Runtime sheet 的冲突在父文档解决：

```text
workspace surface
  -> neutral canvas well
  -> 1px visible frame / restrained shadow
  -> unchanged DesignRuntimeHostFrame iframe
```

- framing 仅作用于 iframe 外围容器或伪元素，不改 iframe CSS、viewport、transform、camera scale、pointer mapping 或 `getBoundingClientRect()` 输入。
- iframe 的宽高、位置、缩放和 selection overlay 结果与变更前误差不超过 1 像素。
- 不给 RuntimeHost message 增加 theme/palette，也不把 `--wb-*` 注入 iframe document。

## 4. 命令呈现

### 4.1 宽屏

保持现有命令分组和键盘合同，只调整层级、间距、按钮状态和 Tooltip。熟悉图标命令不重复显示冗长说明；不熟悉图标继续有 Tooltip 和 aria-label。

### 4.2 641–900 像素

- 保存、导出、组件、属性四个入口显示 Lucide 图标 + 本地化短文字。
- 其他次级命令继续使用图标、Tooltip 或 More 菜单，避免顶栏挤压 Canvas。
- 短文字使用稳定宽度/响应式约束，中文和英文均不得截断关键动词。

### 4.3 640 像素及以下

- 顶栏保持紧凑图标和 More 菜单。
- 底部五项导航继续显示 Components/Layers/Canvas/Inspector/Pages 的本地化文字与现有 roving keyboard 行为。
- 工具条横向空间不足时保留现有命令可达性，不通过隐藏关键命令解决；粗指针媒体下关键按钮最小 44×44。

## 5. 属性控件策略

现有 `DesignerPropertyForm.vue` 已通过 adapter `propertyControls` 为无 hint 的 simple setter 使用真实 Provider 组件；本任务只核对并精修呈现：

- `select`：少量且适合横向比较的选项使用 adapter segmented；选项较多或标签较长时使用 adapter Select，不在 core 手写下拉。
- `boolean`：adapter Switch。
- `number`：adapter InputNumber/Stepper，并保留 min/max/step/Enter/Escape 语义。
- 带继承提示或复合逻辑的 setter 保留 core fallback 与自定义组件，不为了视觉统一改动领域 commit 语义。

若当前 adapter registry 已满足控件类型，只改样式和测试；不得为了“使用组件库”重写已验证的数据流。

## 6. 预期文件范围

- Workbench：`src/app/components/WorkbenchTopbar.vue`、`src/app/index.vue`、`src/styles/studio.css`、`src/styles/responsive.css`，必要时调整同目录类型与测试。
- Designer：仅当控件呈现缺口被测试证实时，修改 PropertyPanel 展示或 adapter property-control 注册；不修改 controller/model/runtime。
- E2E：`e2e/interaction.spec.ts`、`e2e/accessibility.spec.ts` 与对应视觉基线。

## 7. 测试设计

- 组件：900 像素四入口短文字、390 像素顶栏/底栏、More 命令、Tooltip、disabled reason 和焦点恢复。
- 响应式：1440/900/390 × zh/en 哨兵，无横滚、遮挡、重复入口或不可达命令。
- Designer：selection、drag、resize、drop candidate、camera、Preview、键盘命令与属性 commit 回归。
- Geometry：记录变更前后 Canvas/iframe/selection rect，任何轴向差异不得超过 1 像素。
- Runtime：两 Provider 的 Design/Preview computed-style 指纹不受壳层 palette/theme 变化影响。
- Visual/Axe：消费主题子任务定义的基线矩阵，不新增重复笛卡尔快照。

## 8. 回滚

样式、topbar 命令呈现和可选 PropertyPanel 展示按文件职责拆分。若 geometry 或 command 回归，先回滚 Canvas framing/响应式 markup，不改 RuntimeHost 或放宽测试阈值；主题 token 合同保持不回滚。
