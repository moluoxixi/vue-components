# ElementConfigForm

`@moluoxixi/config-form-element` 是基于 Element Plus 输入组件和栅格的轻量配置表单。

- 根节点使用原生 `<form>`，字段使用包内自有 label/control/error 壳；
- inline 布局使用 `ElRow`，grid 布局使用 `ElRow + ElCol`；
- 字段默认通过 `modelValue` + `update:modelValue` 写回外部模型；
- 校验、reset、submit 和 readonly 语义统一由 `@moluoxixi/config-form-headless` 提供。

组件不使用 `ElForm`、`ElFormItem` 或 Element Plus `rules`。`formProps` 只接收原生 form attributes，标签和字段壳属性使用 `formItemProps`，栅格属性使用 `rowProps` / `colProps` / `span`。

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
  <ElementConfigForm
    v-model="model"
    :fields="fields"
    :form-props="{ autocomplete: 'off' }"
    :row-props="{ gutter: 16 }"
  />
</template>
```

## 节点与布局

包含 `field` 的节点绑定模型并参与 Headless 生命周期；没有 `field` 的节点是纯容器。配置化 slots 会递归处理，render-function slot 只负责自定义渲染。

`visible`、`hidden`、`disabled`、`readonly` 和 `required` 支持布尔值或 `(values) => boolean`。readonly 字段跳过校验但保留提交值。

inline 布局不消费 `span` / `colProps`；grid 布局按 Element Plus `ColProps` 消费它们。`getValueFromEvent` 可覆盖默认的首参数取值逻辑。
