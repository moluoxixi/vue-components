# Workbench Shell 样式所有权拆分设计

## 全局层

- `styles/foundation.css`：`:root`/document reset 与无法归单一组件的 overlay 基线。
- `styles/theme.css`：默认 token、Element Plus bridge、四套 palette light/dark token。
- `styles/shell.css`：`.workbench-app` 根布局、scrollbar 与根 focus。

## 组件 owner

- `WorkbenchCommandHint/style/index.css`：passive/command tooltip 与 hint anchor。
- `WorkbenchAppearance{Panel,Popover,Drawer}/style/index.css`：三类 Appearance surface。
- `WorkbenchTopbar/style/index.css`：brand/context/actions/menu/revision 与其响应式规则。
- `PreviewDrawer/style/index.css`：drawer overlay/pane/header/viewport switch 与其响应式规则。
- `app/style/index.css`：App layout、editor pane、mobile dock 和已存在通知。
- `TemplateCreationWorkspace/style/index.css`：mobile action 基础/响应式规则。

## 层叠与兼容

`styles/index.css` 按 foundation -> theme -> shell -> component owners -> studio -> feature owners -> responsive 聚合。mixed selector 按 owner 克隆相同 declaration；owner 内规则保持原顺序。theme 必须先于所有 token consumer，global responsive 保持最后处理真正跨 owner 的断点协调。

无 owner 规则仅在全 production Vue/TS、E2E 与 theme contract 均无使用证据时删除；Visual/axe/interaction E2E 证明最终行为不变。
