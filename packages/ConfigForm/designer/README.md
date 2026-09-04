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

`DesignSurface` 是完整工作区入口，接收受控的 `graph`、命令/历史控制器、组件合同 registry、设计器 registry 和 Vue runtime renderer。需要单独组合界面时，也可以使用 `DesignerCanvas`、`DesignerPalette` 与 `DesignerPropertyPanel`。

## 样式

整套设计器样式：

```ts
import '@moluoxixi/config-form-designer/styles'
```

包同时提供 `design-surface/style`、`designer-canvas/style`、`designer-palette/style`、`designer-material-specimen/style` 和 `designer-property-panel/style` Sass 入口，供按需构建使用。

## 开发验证

```bash
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @moluoxixi/config-form-designer build
```

## License

MIT
