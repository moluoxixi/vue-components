# ConfigFormInternalComponents组件文档

## 用途

`ConfigFormInternalComponents` 记录 ConfigForm 中不作为常规消费入口的内部渲染组件。Element、Antd、Shadcn 及 `@moluoxixi/components` 的适配器共享 runtime 的 `ConfigFormRenderer`；旧 runtime 组件仅作为兼容实现保留。

## 引入

共享 DOM renderer 由 `@moluoxixi/config-form` 根入口导出，UI 适配器直接复用。`FormLayout`、`FormNode`、`FormField`、`ReadonlyField`、`RecursiveField` 等旧 runtime 组件不构成新的配置表单协议。

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| fields | Headless `ConfigFormNode[]` | 无 | 是 | 递归渲染字段或容器节点。 |
| modelValue | 表单模型 | 无 | 是 | 受控模型，由字段绑定写回。 |
| formAttrs/layoutAttrs/cellAttrs | 原生 DOM attributes | `{}` | 否 | 分别传给 form、布局容器和 grid cell。 |
| fieldSpan/columns/gap/inline | 原生布局参数 | 按组件而定 | 否 | 控制 Grid/Flex 布局。 |

## 事件与回调

| 名称 | 触发时机 |
|---|---|
| fieldChange | 内部字段组件接收到真实控件写回事件后触发。 |
| update:modelValue | 部分 runtime 字段组件通过上下文写回时触发，具体以所属包源码为准。 |

## 插槽或 Children

内部组件消费 `fields[].slots` 或 runtime slot invoker，并将上下文补充为字段、模型、当前值、slotProps 和 `setValue`。

## 状态

- Element、Antd、Shadcn UI 包只保留薄适配器，不再维护独立递归组件树。
- runtime 的 `ConfigFormRenderer` 是新的共享 Vue DOM renderer。
- 旧 runtime 组件仍用于兼容入口，不应与新的 Headless 字段协议混用。

## 可访问性

内部字段壳需要把 label、必填、禁用、只读和错误状态传给真实 UI 组件或 DOM。消费方通过顶层字段配置影响这些状态，不应直接绕过顶层 ConfigForm。

## 示例

```ts
// 推荐：通过顶层组件和 fields 配置使用内部组件链路。
import { defineFields, ElementConfigForm } from '@moluoxixi/components'

const { defineField } = defineFields<MyFormValues>()
```

## 测试建议

覆盖递归节点渲染、字段与容器节点分支、slot 上下文、无 label 字段直渲染、inline/grid 布局和不同 UI 库的字段壳差异。

## 变更记录

- 2026-06-07：根据组件发现、源码目录和顶层组件测试生成内部组件发现文档。
