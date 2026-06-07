# AntdConfigForm组件文档

## 用途

`AntdConfigForm` 用声明式 `fields` 渲染 Ant Design Vue 表单，统一字段绑定、递归节点、布局、校验、提交和模板 ref API。组件来源为 `packages/ConfigForm/antd`。

## 引入

```ts
import { AntdConfigForm, antdConfigForm, defineField, defineFields } from '@moluoxixi/components'
import type { AntdConfigFormProps, AntdConfigFormExpose } from '@moluoxixi/components'
```

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| modelValue | `TValues` | 无 | 是 | 表单模型，使用默认 `v-model` 双向绑定。 |
| fields | `AntdConfigFormNode<TValues>[]` | 无 | 是 | 表单节点配置；字段节点绑定值，容器节点只渲染组件和 slots。 |
| rules | `ConfigFormRules<TValues>` | `{}` | 否 | Ant Design Vue Form 全局校验规则。 |
| formProps | `Partial<Omit<FormProps, 'model' \| 'rules'>>` | `{}` | 否 | 透传给 Ant Design Vue Form。 |
| rowProps | `Partial<RowProps>` | `{ gutter: 16 }` | 否 | 透传给 Ant Design Vue Row。 |
| colProps | `Partial<ColProps>` | `{}` | 否 | 透传给 Ant Design Vue Col。 |
| fieldSpan | `number` | `24` | 否 | grid 布局下字段默认栅格跨度。 |
| inline | `boolean` | `false` | 否 | 行内布局开关；也可由 `formProps.layout='inline'` 触发。 |

## 事件与回调

| 名称 | 触发时机 |
|---|---|
| update:modelValue | 字段写入或批量写入后触发。 |
| change | 任意字段写入后触发，参数为完整表单值。 |
| fieldChange | 单字段写入后触发，包含 `field`、`value`、`values`。 |
| submit | `submit()` 或原生 submit 校验通过后触发。 |
| error | 校验失败时触发，参数为 Ant Design Vue validate 错误对象。 |

## 插槽或 Children

| 名称 | 说明 |
|---|---|
| default | 操作区插槽，参数包含 `model`、`submit`、`resetFields`。 |
| fields[].slots | 字段或容器配置化 slot，可声明 render 函数或嵌套节点。 |

## 状态

- 组件合并顶层 `rules` 与字段级 `rules`。
- 有 `label` 的字段渲染为 Ant Design Vue FormItem；无 `label` 的字段直接渲染组件。
- 支持 `valueProp/trigger/getValueFromEvent`，并通过 Ant Design Vue 插件适配 Switch 等组件的写回协议。
- inline 布局使用 Ant Design Vue Row，不为顶层节点包裹 Col。

## 可访问性

字段 label、必填状态和错误提示由 Ant Design Vue FormItem 承载。配置字段时应提供可读 `label`，无 label 字段应由真实组件自行提供可访问名称。

## 示例

```vue
<AntdConfigForm
  v-model="model"
  :fields="fields"
  :form-props="{ layout: 'vertical' }"
  @submit="handleSubmit"
/>
```

## 测试建议

覆盖字段渲染、模型写回、字段级校验合并、inline 与 grid 布局、配置化 slot、容器节点、Ant Design Vue 特殊值协议和提交失败错误透出。

## 变更记录

- 2026-06-07：根据源码、类型和测试生成组件契约文档。
