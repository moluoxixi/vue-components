# 配置化表单设计器功能与界面优化技术设计

## 设计目标

- 在不改变文档协议和公共组件 API 的前提下重构 Designer 工作区。
- 让布局行为由组件容器决定，并保持表单预览 breakpoint 语义不变。
- 建立 UI 框架无关的键盘和焦点行为，使 Element Plus / Ant Design Vue adapter 共享同一编辑器外壳。
- 只修复已有协议链路的功能缺口，不把 Runtime 表单状态复制到 Designer canvas。

## 模块边界

| 模块 | 责任 |
| --- | --- |
| `config-form-designer` | 工作区模式、面板导航、焦点边界、页签/工具栏键盘模型、unsupported material fallback、核心样式与单测 |
| `designer-element-plus` | Element Plus 中文 fallback locale 与现有 adapter 回归 |
| `designer-antd-vue` | Ant Design Vue 中文 fallback locale 与现有 adapter 回归 |
| `ConfigForm/playground` | 共享 custom validator、浏览器工作流、视觉与跨浏览器验证 |
| Runtime / Headless / Core | 不新增职责；仅作为既有编译与 Preview 回归对象 |

本任务不修改 `DesignerDocument`、material registry、compiler 输出或包依赖方向，因此不需要协议迁移。

## 工作区状态模型

在 Designer 内新增私有工作区 composable，建议命名为 `useDesignerWorkspace`：

```ts
type DesignerWorkspaceMode = 'desktop' | 'medium' | 'narrow'
type DesignerWorkspaceView = 'palette' | 'canvas' | 'properties'

interface DesignerWorkspaceState {
  containerWidth: Ref<number | undefined>
  mode: ComputedRef<DesignerWorkspaceMode>
  activeView: Ref<DesignerWorkspaceView>
  openSidePanel: Ref<'palette' | 'properties' | undefined>
}
```

### 容器测量

- 复用 ConfigTable 的生产模式：mounted 后先读 `getBoundingClientRect().width`，再在可用时创建 `ResizeObserver`，unmount 时 disconnect。
- `>1100` 为 desktop，`721..1100` 为 medium，`<=720` 为 narrow。阈值沿用现有视觉断点，降低迁移风险。
- `ResizeObserver` 缺失时保留首次测量，不退回 `window.resize`。
- `activeBreakpoint` 继续只控制表单 Desktop / Tablet / Mobile 预览，不参与工作区布局。

### 模式转换

- 进入 desktop 时关闭临时侧滑面板。
- 进入 medium 时画布常驻，侧滑面板最多打开一个。
- 进入 narrow 时将已打开的 medium 面板映射为同名 active view，否则默认 canvas。
- 三个面板组件保持 mounted，通过 `hidden`、`inert` 和 CSS 布局切换可见性，避免丢失 setter draft 与 DOM scrollTop。

### 操作包装

默认组件与 slot scope 统一使用工作区包装后的 `addMaterial` / `selectNode`：

- narrow 添加成功后切到 canvas；选择有效节点后切到 properties。
- medium 选择有效节点后打开 properties side panel。
- desktop 不自动改变面板状态。

文档写入仍调用原 controller command；包装层只处理导航，不拥有业务状态。

## 布局与视觉结构

### Desktop

- 保留 `232px / minmax(0, 1fr) / 304px` 三栏基线，允许通过内部 CSS custom properties集中维护尺寸。
- 每个区域只有自身内容滚动，根工作区不制造额外纵向滚动。

### Medium

- canvas 占满工作区。
- palette 从左侧、properties 从右侧作为 root 内 `position:absolute` 面板进入；共用一个 scrim，打开一侧会关闭另一侧。
- 面板提供显式关闭按钮、Escape 关闭、焦点约束与触发器恢复；背景区域在面板打开时不可交互。

### Narrow

- 工具栏下方增加三项 workspace tabs，采用稳定尺寸，不随标题或 locale 改变轨道宽度。
- `hidden` 的面板不进入可访问树或 Tab 顺序，但实例不卸载。
- 每个视图只保留一个明确滚动容器，页面不得同时滚动 palette / canvas / properties。

### 视觉语言

- 在 Designer root 集中定义中性背景、边界、表面、强调、危险、焦点和阴影 token，沿用现有品牌色而不制造单色主题。
- 统一顶部 toolbar、workspace tabs、drawer command 和 node action button 的尺寸与 focus-visible 外观。
- selection frame 继续是唯一节点选择框，CSS 重构不得恢复双重边框或改变 runtime cell 几何。
- 不给 panel 或 page section 增加装饰卡片；边界由全高分隔面和工作区层级表达。

## 可访问性设计

### Focus boundary

新增 UI 框架无关的私有 composable，覆盖 transfer dialog、preview dialog 和 medium side panel：

- 打开前记录触发器。
- nextTick 后聚焦显式 initial target，fallback 到第一个可聚焦元素或容器。
- Tab / Shift+Tab 在 visible、enabled、非 `tabindex=-1` 元素间循环。
- Escape 走统一 close callback。
- 关闭后仅在焦点丢失到 body/document root 时恢复触发器，不抢占用户已选择的外部控件。

所有关闭入口必须走同一函数，禁止模板中直接写 `previewOpen = false` 绕过 cleanup。

### Tabs 与 toolbar

- 属性 tabs 和窄屏 workspace tabs 使用稳定 `id`、`aria-controls`、`aria-labelledby` 与 `role=tabpanel`。
- 采用仓库 `WorkspaceTabs` 已验证的 Left / Right / Home / End 循环与 roving tabindex 模式。
- toolbar 保持一个 Tab stop，方向键移动焦点但不执行命令，并跳过 disabled button。

### Node actions

- 保留节点方向键结构编辑，不将其改造成 roving focus。
- 将 action bar 调整到 focus shell 后的 DOM 顺序，视觉位置继续 absolute 附着在选择框右上角。
- 节点命令完成后复用 `focusNode()`；删除时 controller selection 决定安全 fallback。

## 功能缺口设计

### Blur listener

- 删除 `DesignerNodePreview` 为 `blurTrigger` 写入空函数的逻辑。
- 不新增 blur emit，不在 canvas 运行 Runtime touched / validation。
- registration 或 node props 中已有 listener 按 Vue 原生事件 props 继续透传。

### Playground custom validator

- 定义一个共享 `DesignerRegistryLayer`，向两个 adapter factory 同时注入一个使用 `params` 的 custom validator。
- 不在 Element/Antd 分别复制 validator，不修改 registry API。
- E2E 从 Validation setter 选择该 key、导出规则，并在 Runtime Preview blur 后验证消息。

### Unsupported material

- `DesignerNodePreview` 使用现有 locale context 渲染 `canvas.unsupportedMaterial`，文案必须包含 `node.material`。
- Element Plus 与 Ant Design Vue locale 均提供相同 key。
- 未知 container 不渲染未知 slots，保留 registry diagnostic 和空结构安全性。

## 测试设计

### 单元测试

- ResizeObserver 首次测量、三种 mode、disconnect 和缺失 API fallback。
- medium panel 互斥、narrow add/select 导航、hidden panel 状态保留。
- dialog / drawer 初始焦点、循环、Escape、条件恢复。
- property/workspace tabs 的 ARIA 与 roving；toolbar 跳过 disabled。
- node action DOM 顺序、现有方向键语义和命令后焦点。
- blur listener 透传、unsupported material locale 插值。
- 两套 adapter locale 与共享 custom validator registry。

### 浏览器测试

- Chromium 完整现有 Designer 场景，加 desktop / embedded-medium / narrow container 几何与三张稳定外壳截图。
- Chromium 覆盖非法导入、clipboard 成功、download 文件名与内容。
- Firefox/WebKit 使用定向 smoke：三种布局、dialog focus/Escape、tabs/toolbar keyboard、palette 与 node drag、Element/Antd Preview。
- 视觉截图只在 Chromium 执行，跨浏览器以语义、几何和行为断言为主。

## 风险与回滚

- `ResizeObserver` 与 CSS mode 不一致会产生闪烁；由单一 JS mode 写 root data attribute，CSS 只消费该 attribute，避免双断点源。
- hidden 常驻 DOM 可能保留 Sortable 实例；mode 变化后需让现有 list 生命周期重新计算可见容器，但不得重复创建 observer/listener。
- focus trap 选择器遗漏会造成不可达命令；用参数化单测覆盖空 dialog、单元素和 disabled 元素。
- screenshot 易受 adapter 版本影响；裁剪到 Designer shell，并固定 locale、数据、字体加载与动画状态。
- 所有变更均可按“工作区状态 / 可访问性 / 功能缺口 / 视觉 CSS”四组独立回滚，不涉及文档迁移。
