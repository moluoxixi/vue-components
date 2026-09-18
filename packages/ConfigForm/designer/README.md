# @moluoxixi/config-form-designer

ConfigForm 的物料无关轻量 Schema 设计器核心。它提供物料注册、页面图编辑、画布、物料面板和属性面板，用于编辑结构、布局、静态属性、默认值、静态 options 与基础校验，不内置 Element Plus 或 Ant Design Vue 物料。Runtime 是主产品，Designer 是可选作者工具；完整定位见 [ConfigForm 产品边界](../PRODUCT.md)。

设计器的**契约层保持库无关**：物料注册、`runtime`/`dragVisual` 插槽、属性 setter 定义、页面图与命令都由核心定义，适配包（`designer-element-plus` / `designer-antd-vue`）负责注入具体组件库的物料与控件。设计器**自身的界面控件统一构建在 Element Plus 之上**（属性面板的输入框、数字、开关、下拉、日期时间等），Element Plus 因此是 peer 依赖：宿主需要注册 `ElementPlus` 插件并引入其样式（`element-plus/dist/index.css`）。若要换掉设计器外壳的控件库，替换点集中在属性面板 setter 与工具条控件；也可以给 EP 换一套 CSS 命名空间（`ElConfigProvider :namespace` + 以同名前缀编译 EP SCSS）来避免与宿主样式冲突——这会同时改变 DOM 类名，需要一起更新设计器样式与依赖 `el-*` 的测试。

## 产品边界

默认 Inspector 精确只提供 `properties` 与 `validation`。Designer 不提供事件编辑、事件转发、事件编排、底层 bindings、conditions、reactions、动态 option source 或 Automation 作者入口。程序化配置中已有的高级 validation、conditions、reactions、Data Source、option source、value scope 和 bindings 由 Runtime 消费，普通设计编辑必须无损保留，但不会为它们提供默认作者 UI。

复杂组件逻辑由工程师在宿主 Vue/TypeScript config 中通过 `props.onX` 函数维护。函数不进入 Designer JSON、ProjectDocument、IndexedDB、Preview transport 或生成源码；Designer 也不通过事件总线或 iframe RPC 转发这些函数。

## 安装

```bash
pnpm add @moluoxixi/config-form-designer vue zod element-plus
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
