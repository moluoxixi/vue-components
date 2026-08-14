# ElementConfigForm

`@moluoxixi/config-form-element` 是面向 Element Plus 输入组件的轻量配置表单。

- 根节点使用原生 `<form>`，字段使用包内自有 label/control/error 壳；
- inline 布局使用原生 Flex，grid 布局使用原生 CSS Grid；
- 字段默认通过 `modelValue` + `update:modelValue` 写回外部模型；
- 校验、reset、submit 和 readonly 语义统一由 `@moluoxixi/config-form-headless` 提供；`validateOn` 控制 change/blur 校验触发且 submit 校验始终启用；适配器同时透传独立的 dirty/touched 状态、`metaChange`、默认 slot `meta` 及 `getMeta` / `getFieldMeta` / `setTouched`。

组件不使用 `ElForm`、`ElFormItem`、`ElRow`、`ElCol` 或 Element Plus `rules`。`formAttrs` 传给原生 form，`layoutAttrs` / `cellAttrs` 分别传给原生布局和 grid cell div；布局由 `columns`、`gap`、`fieldSpan` 和字段 `span` 控制。

```vue
<script setup lang="ts">
import { defineFields } from '@moluoxixi/config-form-headless'
import { ElementConfigForm } from '@moluoxixi/config-form-element'
import '@moluoxixi/config-form-element/styles'
import { ElInput, ElTag } from 'element-plus'
import { h, shallowRef } from 'vue'
import { z } from 'zod'

interface UserForm {
  locked: boolean
  name: string
}

const model = shallowRef<UserForm>({ locked: false, name: '' })
const { defineField } = defineFields<UserForm>()
const fields = [
  defineField({
    component: ElInput,
    field: 'name',
    label: '姓名',
    props: { placeholder: '请输入姓名' },
    required: true,
    schema: z.string().trim().min(2, '姓名至少 2 个字符'),
    validateOn: 'blur',
    readonly: values => values.locked,
    readonlyRender: ({ value }) => h(ElTag, null, () => value || '-'),
  }),
]
</script>

<template>
  <ElementConfigForm v-model="model" :fields="fields" :form-attrs="{ autocomplete: 'off' }" :columns="12" gap="16px" />
</template>
```

## 语义组件注册

适配器内置 `text`、`textarea`、`number`、`boolean` 和 `select` 别名，因此 schema 可以直接写 `component: 'text'`。`components` prop 可注册业务别名或覆盖同名默认项；完整注册项还可提供默认 props 和绑定协议，字段上的显式配置优先。

```ts
const fields = [defineField({ component: 'text', field: 'name', label: '姓名' })]
```

节点的 `extensions` 供设计器和业务插件读取，不会透传给 Element Plus 组件或 DOM。

## 节点与布局

包含 `field` 的节点绑定模型并参与 Headless 生命周期；没有 `field` 的节点是纯容器。配置化 slots 会递归处理，render-function slot 只负责自定义渲染。

`visible`、`hidden`、`disabled`、`readonly` 和 `required` 支持布尔值或 `(values) => boolean`。readonly 字段跳过校验但保留提交值。

inline 布局不消费 `span` / `cellAttrs`；grid 布局将 `span` 映射到 CSS Grid，并把 `cellAttrs` 作为原生 div attributes。`getValueFromEvent` 可覆盖默认的首参数取值逻辑。
