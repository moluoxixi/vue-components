# ShadcnConfigForm组件文档

## 用途

`ShadcnConfigForm` 用声明式 `fields` 渲染 shadcn-vue 风格表单，提供无第三方 Form 实例依赖的校验、错误展示、布局和模板 ref API。组件来源为 `packages/ConfigForm/shadcn`。

## 引入

```ts
import type { ShadcnConfigFormExpose, ShadcnConfigFormProps } from '@moluoxixi/components'
import { defineField, defineFields, ShadcnConfigForm } from '@moluoxixi/components'
```

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| modelValue | `TValues` | 无 | 是 | 表单模型，使用默认 `v-model` 双向绑定。 |
| fields | `ShadcnConfigFormNode<TValues>[]` | 无 | 是 | 表单节点配置；字段节点绑定值，容器节点只渲染组件和 slots。 |
| rules | `ConfigFormRules<TValues>` | `{}` | 否 | 顶层字段校验规则。 |
| formProps | `FormHTMLAttributes` | `{}` | 否 | 透传给原生 `form`。 |
| rowProps | `HTMLAttributes` | `{}` | 否 | 透传给布局行容器。 |
| colProps | `HTMLAttributes` | `{}` | 否 | 透传给 grid cell。 |
| fieldSpan | `number` | `24` | 否 | grid 布局下字段默认栅格跨度。 |
| inline | `boolean` | `false` | 否 | 行内布局开关。 |

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

- 内部维护 `errors`，`setValue` 会清理当前字段错误。
- `resetFields` 将字段重置为初始快照并清理校验状态。
- grid 布局使用 CSS grid，inline 布局使用 flex。
- 必填校验、字段级规则和顶层规则由 shadcn 工具函数收集执行。

## 可访问性

字段壳使用 `data-field` 与错误区域承载语义；调用方应提供 `label`，自定义字段组件应保留可访问名称和错误提示关联能力。

## 示例

```vue
<ShadcnConfigForm
  v-model="model"
  :fields="fields"
  :field-span="12"
  @submit="handleSubmit"
  @error="handleError"
/>
```

## 测试建议

覆盖字段渲染、模型写回、必填错误展示、inline 与 grid 布局、配置化 slot、容器节点、提交成功和 `getErrors` 暴露。

## 变更记录

- 2026-06-07：根据源码、类型和测试生成组件契约文档。
