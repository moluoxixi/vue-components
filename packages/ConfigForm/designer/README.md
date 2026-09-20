# @moluoxixi/config-form-designer

ConfigForm 的物料无关设计器核心。当前版本提供物料注册、SurfaceGraph v3 编辑、画布、物料面板和属性面板，用于编辑结构、布局、静态属性、默认值、静态 options、Dataset/Resource 绑定、字段 Required、RuleSet v2 通用校验和安全本地交互，不内置 Element Plus 或 Ant Design Vue 物料。Designer 只负责聚焦一个 Surface 的作者体验；项目资产、Experience 会话、持久化和 Source 命令由 Studio 组合根负责。完整定位见 [ConfigForm 产品边界](../PRODUCT.md)，当前与目标状态见 [路线图](../ROADMAP.md)。

设计器的**契约层保持库无关**：物料注册、`runtime`/`dragVisual` 插槽、属性 setter 定义、页面图与命令都由核心定义，适配包（`designer-element-plus` / `designer-antd-vue`）负责注入具体组件库的物料与控件。设计器**自身的界面控件统一构建在 Element Plus 之上**（属性面板的输入框、数字、开关、下拉、日期时间等），Element Plus 因此是 peer 依赖：宿主需要注册 `ElementPlus` 插件并引入其样式（`element-plus/dist/index.css`）。若要换掉设计器外壳的控件库，替换点集中在属性面板 setter 与工具条控件；也可以给 EP 换一套 CSS 命名空间（`ElConfigProvider :namespace` + 以同名前缀编译 EP SCSS）来避免与宿主样式冲突——这会同时改变 DOM 类名，需要一起更新设计器样式与依赖 `el-*` 的测试。

## 当前实现

默认 Inspector 精确提供 `properties`、`validation` 与 `interactions`。`interactions` 只编辑安全表达式状态投影、`set/copy/clear` 值联动和每个语义触发器最多一个主要 UI 动作；它不是事件编辑器。Designer 不提供事件转发、事件编排、Flow、脚本、底层 bindings、conditions、reactions、动态 option source 或 Automation 作者入口。复杂业务逻辑由工程师在导出源码/config 中维护；Designer 持久化的 SurfaceGraph 只接受当前合同定义的节点、静态属性、Dataset/Resource 引用和安全本地交互。

Validation 将 `required` / `requiredMessage` 作为字段一级控件展示，不把 Required 放进“Add rule”。通用规则使用 RuleSet v2，并按物料 `value.kind` 限制 base 与可选规则；RuleSet 没有 `time` base，因此时间物料只显示 Required 和 `validateOn`，不会伪装成 `date` 校验。regex、日期和数字等非法输入中间态只保留在本地 draft，合法时才提交命令。属性命令被 Model 拒绝时，控件回灌权威 graph 值并保留诊断。Select 的静态 options 变化时，同一命令会清除失效默认值，并原子重算已有 `enum` / `literal` base；新选项无法表达该 base 时清除完整 validation。options、默认值和 validation 共用一个历史项，一次 Undo 整体恢复。

复杂组件逻辑由工程师在宿主 Vue/TypeScript config 中通过 `props.onX` 函数维护。函数不进入 Designer JSON、ProjectDocument、IndexedDB、Preview transport 或生成源码；Designer 也不通过事件总线或 iframe RPC 转发这些函数。

当前 API 以单个 `SurfaceGraph` 为中心，画布通过 `runtime` / `dragVisual` 插槽接入宿主；项目级 Surface、Dataset、Resource 目录与 Prototype Experience 会话由 Studio 组合根负责，Designer 不提供事件函数或接口调用能力。

## 目标责任

Designer 聚焦一个 Page/Dialog/Drawer `SurfaceAsset`，提供结构、响应式 Grid/Flex、受控视觉属性、校验和静态 Demo 所需的安全本地交互引用。交互只包含安全表达式状态投影、`set/copy/clear` 值动作和每个语义触发器最多一个主要 UI 动作；不接受任意 DOM 事件名、函数、动作链或 Flow。Registry projection 输出 v3 的 kind、semantic triggers、state projection、Dataset/Resource capability 字段。

Designer 不拥有项目资产树、页面历史、浮层实例栈、HTTP、Source generator 或复制/下载命令。`SurfaceInstance` 和 Experience 行为由独立的 `@moluoxixi/config-form-prototype-runtime` 负责；Designer 只消费其上游 Surface 合同，不反向依赖该运行时。

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
