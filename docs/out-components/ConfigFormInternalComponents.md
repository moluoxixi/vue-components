# ConfigFormInternalComponents组件文档

## 用途

`ConfigFormInternalComponents` 记录 ConfigForm 各包中发现但不作为常规消费入口的内部渲染组件，避免组件发现阶段遗漏 `src/components/`。这些组件服务于 `ElementConfigForm`、`AntdConfigForm`、`ShadcnConfigForm` 和 `RuntimeConfigForm` 的递归渲染链路。

## 引入

内部组件默认通过包内 `FormLayout`、`ConfigFormNode`、`ConfigFormField`、`FormComponent`、`FormNode`、`FormField`、`ReadonlyField`、`RecursiveField` 等门面被所属组件使用。消费方应优先使用对应顶层 ConfigForm 组件；直接引入内部组件属于 `MISSING public contract`。

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| nodes/field/node | UI 包或 runtime 的已解析节点类型 | 按组件而定 | 是 | 递归渲染字段或容器节点。 |
| model/values/errors | 表单模型与错误对象 | 按组件而定 | 是 | 供字段绑定、可见性和错误展示使用。 |
| rowProps/colProps/fieldSpan/inlineLayout | UI 包布局 props | 按组件而定 | 否 | 由顶层 ConfigForm 传入并适配不同 UI 库。 |
| fieldChange/onFieldChange | 字段变更请求回调 | 无 | 是 | 内部把子字段写回顶层模型。 |

## 事件与回调

| 名称 | 触发时机 |
|---|---|
| fieldChange | 内部字段组件接收到真实控件写回事件后触发。 |
| update:modelValue | 部分 runtime 字段组件通过上下文写回时触发，具体以所属包源码为准。 |

## 插槽或 Children

内部组件消费 `fields[].slots` 或 runtime slot invoker，并将上下文补充为字段、模型、当前值、slotProps 和 `setValue`。

## 状态

- Element、Antd、Shadcn UI 包均发现 `FormLayout`、`ConfigFormNode`、`ConfigFormField`、`FormComponent`。
- runtime 包发现 `FormLayout`、`FormNode`、`FormField`、`FormItem`、`FormComponent`、`ReadonlyField`、`RecursiveField`。
- 这些组件不单独声明稳定对外 API；对外契约由对应顶层 ConfigForm 文档承载。

## 可访问性

内部字段壳需要把 label、必填、禁用、只读和错误状态传给真实 UI 组件或 DOM。消费方通过顶层字段配置影响这些状态，不应直接绕过顶层 ConfigForm。

## 示例

```ts
// 推荐：通过顶层组件和 fields 配置使用内部组件链路。
import { defineField, ElementConfigForm } from '@moluoxixi/components'
```

## 测试建议

覆盖递归节点渲染、字段与容器节点分支、slot 上下文、无 label 字段直渲染、inline/grid 布局和不同 UI 库的字段壳差异。

## 变更记录

- 2026-06-07：根据组件发现、源码目录和顶层组件测试生成内部组件发现文档。
