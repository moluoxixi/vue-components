# Designer 中宽 Inspector Drawer 技术设计

## 状态模型

保留 `workspaceMode` 与 narrow `activeWorkspaceView`，将 desktop 的两个独立布尔值和 medium 面板状态分离：

```ts
type DesignerSidePanel = 'palette' | 'properties'

interface DesignerWorkspaceState {
  paletteOpen: Ref<boolean>       // desktop docked panel
  propertiesOpen: Ref<boolean>    // desktop docked panel
  mediumPanel: Ref<DesignerSidePanel | undefined>
  activeWorkspaceView: Ref<'palette' | 'canvas' | 'properties'>
}
```

- desktop 继续使用 `paletteOpen / propertiesOpen`。
- medium 的两个 toolbar command 操作同一个 `mediumPanel`，天然互斥。
- narrow 继续使用 `activeWorkspaceView`，不显示重复 sidebar controls。
- mode 转换只映射导航状态，不销毁 Palette 或 PropertyPanel 实例。

## DOM 与布局

workspace 根在 medium 使用 `position: relative`，grid 只有 `canvas` 一个 area：

```text
workspace
  canvas (full area)
  palette panel    -> absolute inset-block:0; inset-inline-start:0
  properties panel -> absolute inset-block:0; inset-inline-end:0
```

- Properties drawer 宽度沿用 `304px`，并限制为 `min(304px, calc(100% - 280px))`，为 Canvas 保留最小可操作区域。
- Palette drawer 使用现有 medium `210px` 基线。
- drawer 以 border + shadow 表示覆盖关系，不使用 scrim。
- hidden drawer 继续绑定 `hidden` 与 `inert`；可见 drawer 使用命名 `aside` / `region`，不是 dialog。
- z-index 只高于 Canvas surface 和 node action，低于 import/export/preview modal。

## 交互

- 点击 Materials command：`mediumPanel = mediumPanel === 'palette' ? undefined : 'palette'`。
- 点击 Properties command：同理切换 properties，并自动关闭 palette。
- medium 选中有效节点时打开 Properties；drawer 已打开时只更新内容。
- Escape 由 drawer 根监听并关闭当前 panel；事件不影响 Designer 的 node keyboard commands。
- 关闭时若 active element 位于 drawer 内或回到 body，则恢复对应 toolbar trigger；若用户已点击 Canvas 新节点，不抢焦点。

## 属性字段与 Tabs

- `.property-field` 使用纵向 grid：label row + control row；短的 binary/number setter 可通过显式 modifier 保留紧凑同行，不依赖文本自然换行。
- label 统一 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`，并由 setter 现有 label/aria-label 提供完整名称。
- tabs 生成稳定 ids：`<workspaceId>-property-tab-*` 与 `*-panel-*`，绑定 `aria-controls` / `aria-labelledby`。
- roving keyboard 只改变 PropertyPanel 内部 active tab，不写 Designer document。

## 测试

- 单测模拟 root width `900px`，验证 Canvas 常驻、drawer 互斥、hidden/inert/aria-expanded、Escape 和条件式焦点恢复。
- 单测在 Properties 打开时选择另一节点，验证 drawer 不关闭且 heading/field 更新。
- 单测覆盖 property tabs 的 ArrowLeft/Right/Home/End 与 tabpanel 关系。
- Playwright 在 Workbench 内测量 Properties 与 Canvas 的 `y/height` 区间，断言 Designer 高度不随 drawer 打开变化。
- Chromium 对两套 adapter 截取 medium shell；desktop/narrow 保留现有语义回归。

## 回滚

状态与 CSS 可作为单一提交回滚，不涉及文档或持久化迁移。若 overlay 在特定 adapter 出现 popup stacking 问题，只调整 drawer/popup 层级，不恢复 Properties 第二行布局。
