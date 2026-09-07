# @moluoxixi/config-form-designer

ConfigForm 的 UI 库无关设计器核心。它提供物料注册、页面图编辑、画布、物料面板、属性面板和完整设计工作区，不内置 Element Plus 或 Ant Design Vue 物料。

## 安装

```bash
pnpm add @moluoxixi/config-form-designer vue zod
```

实际项目通常还需要选择一个设计器适配包：

- Element Plus：`@moluoxixi/config-form-designer-element-plus`
- Ant Design Vue：`@moluoxixi/config-form-designer-antd-vue`

## 注册业务物料

普通字段使用 `defineDesignerFieldMaterial` 描述可编辑属性，再交给 registry。调用方不需要手写节点版本、类型或 `createNode`。

```ts
import { createDesignerRegistry, defineDesignerFieldMaterial } from '@moluoxixi/config-form-designer'

const customerCode = defineDesignerFieldMaterial({
  key: 'project.customer-code',
  title: '客户编码',
  category: '业务字段',
  component: 'input',
  value: { kind: 'text', default: '' },
  props: {
    placeholder: {
      label: '占位文字',
      control: 'text',
      default: '请输入客户编码',
    },
  },
})

export const designerRegistry = createDesignerRegistry({
  materials: [customerCode],
})
```

`DesignSurface` 接收受控 `graph`、命令/历史控制器、组件合同 registry、设计器 registry，以及用于属性编辑的 `renderer` 组件。画布真实渲染通过 `runtime` 与 `dragVisual` 插槽由宿主提供；插槽只有图、模型、命令和 geometry/pointer bridge，不传递 Vue RuntimePlan。Workbench 在这些插槽中使用独立 iframe RuntimeHost。Designer 生产依赖不包含 Runtime 或 Vue backend；响应式规则来自 Core。

## 样式

整套设计器样式：

```ts
import '@moluoxixi/config-form-designer/styles'
```

包同时提供 `design-surface/style`、`designer-canvas/style`、`designer-palette/style` 和 `designer-property-panel/style` Sass 入口。宿主负责所注入属性 renderer 的样式。

## 开发验证

```bash
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @moluoxixi/config-form-designer build
```

## License

MIT
