# ElementConfigForm组件文档

## 用途

`ElementConfigForm` 用声明式 `fields` 渲染 Element Plus 输入组件，保留独立公共类型与薄适配器，并复用共享 Vue DOM renderer 的递归节点、原生布局、校验展示、提交和模板 ref API。

## 引入

```ts
import type { ElementConfigFormExpose, ElementConfigFormProps } from '@moluoxixi/components'
import { defineField, defineFields, ElementConfigForm } from '@moluoxixi/components'
```

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| modelValue | `TValues` | 无 | 是 | 表单模型，使用默认 `v-model` 双向绑定。 |
| fields | `ElementConfigFormNode<TValues>[]` | 无 | 是 | 表单节点配置；字段节点绑定值，容器节点只渲染组件和 slots。 |
| defaultValues | `Partial<TValues>` | 无 | 否 | 显式 reset 基准。 |
| readonly | `boolean \| ((values) => boolean)` | `false` | 否 | 表单级展示态。 |
| readonlyRender | `ElementConfigFormReadonlyRender` | 内置文本 | 否 | 表单级只读展示函数。 |
| formProps | `FormHTMLAttributes` | `{}` | 否 | 透传给原生 `form`。 |
| rowProps | `HTMLAttributes` | `{}` | 否 | 透传给原生 Grid/Flex 容器。 |
| colProps | `HTMLAttributes` | `{}` | 否 | 透传给原生 grid cell。 |
| columns | `number` | `24` | 否 | CSS Grid 列数。 |
| gap | `string` | `16px` | 否 | Grid/Flex 间距。 |
| fieldSpan | `number` | `24` | 否 | grid 布局下字段默认栅格跨度。 |
| inline | `boolean` | `false` | 否 | 原生 Flex 行内布局开关。 |

## 事件与回调

| 名称 | 触发时机 |
|---|---|
| update:modelValue | 字段写入或批量写入后触发。 |
| change | 任意字段写入后触发，参数为完整表单值。 |
| fieldChange | 单字段写入后触发，包含 `field`、`value`、`values`。 |
| submit | `submit()` 或原生 submit 校验通过后触发。 |
| error | 校验失败时触发，参数为 `{ [field]: string[] }`。 |

## 插槽或 Children

| 名称 | 说明 |
|---|---|
| default | 操作区插槽，参数包含 `model`、`submit`、`resetFields`。 |
| fields[].slots | 字段或容器配置化 slot，可声明 render 函数或嵌套节点。 |

## 状态

- required、Zod schema 和异步 validator 由 headless controller 统一执行。
- 所有字段都生成原生字段壳；label 可选，错误 DOM 与 `data-field` 不依赖 label。
- `visible/hidden/disabled/readonly/required` 可基于当前模型动态计算。
- inline 使用 Flex 且不消费 `span/colProps`；grid 将 `span/fieldSpan` 映射到 CSS Grid。

## 可访问性

共享 renderer 生成唯一 control/error id、label `for`、`aria-required`、`aria-invalid` 和 `aria-describedby`。无 label 字段仍保留错误关联，但真实控件需自行提供可访问名称。

## 示例

```vue
<ElementConfigForm
  v-model="model"
  :fields="fields"
  @submit="handleSubmit"
  @error="handleError"
>
  <template #default="{ submit, resetFields }">
    <ElButton @click="submit">提交</ElButton>
    <ElButton @click="resetFields">重置</ElButton>
  </template>
</ElementConfigForm>
```

## 测试建议

覆盖字段渲染、模型写回、字段级校验合并、inline 与 grid 布局、配置化 slot、容器节点、`visible/disabled` 派生、提交成功和失败。

## 变更记录

- 2026-06-07：根据源码、类型和测试生成组件契约文档。
