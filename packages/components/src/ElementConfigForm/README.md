# ElementConfigForm

`ElementConfigForm` 是 components 包内置的 Element Plus 轻量配置表单。

它只做四件事：

- 用 `ElForm` / `ElFormItem` / `ElRow` / `ElCol` 渲染字段；
- 通过字段配置把组件的 `modelValue` 和 `update:modelValue` 连接到外部 `v-model`；
- 递归渲染 slots 内的字段节点和容器节点；
- 把校验交给 Element Plus `rules`，不接入 schema、runtime plugin 或自定义 FormItem。

```vue
<script setup lang="ts">
import { ElInput } from 'element-plus'
import { ElementConfigForm, defineField } from '@moluoxixi/components'
import { shallowRef } from 'vue'

interface UserForm {
  name: string
  status: string
}

const model = shallowRef<UserForm>({ name: '', status: 'enabled' })

const fields = [
  defineField<UserForm>({
    field: 'name',
    label: '姓名',
    component: ElInput,
    props: { placeholder: '请输入姓名' },
    rules: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  }),
  defineField<UserForm>({
    component: 'section',
    props: { class: 'toolbar' },
    slots: {
      default: [
        defineField<UserForm>({
          component: 'button',
          props: { type: 'button', textContent: '普通容器子节点' },
        }),
      ],
    },
  }),
]
</script>

<template>
  <ElementConfigForm
    v-model="model"
    :fields="fields"
    :form-props="{ labelWidth: '96px' }"
  />
</template>
```

## 节点配置

`fields` 接收字段节点或容器节点：

- 字段节点：包含 `field`，会渲染 `ElFormItem`，绑定表单值并参与 Element Plus `rules`；
- 无 label 字段节点：包含 `field` 但没有 `label`，只绑定表单值，不生成 `ElFormItem`；
- 容器节点：不包含 `field`，只渲染 `component`、`props` 和 `slots`，不会生成 `ElFormItem`。

`slots` 支持配置化节点、节点数组或 render 函数。配置化 slot 会递归渲染，slot 内带 `field` 的节点仍然会绑定表单值和字段级规则。

`visible`、`hidden` 和 `disabled` 支持布尔值或 `(values) => boolean` 函数条件。

```ts
import { defineFields } from '@moluoxixi/components'
import { ElOption, ElSelect } from 'element-plus'

interface UserForm {
  status: string
}

const { defineField } = defineFields<UserForm>()

const fields = [
  defineField({
    field: 'status',
    label: '状态',
    component: ElSelect,
    slots: {
      default: [
        defineField({
          component: ElOption,
          props: { label: '启用', value: 'enabled' },
        }),
        defineField({
          component: ElOption,
          props: { label: '停用', value: 'disabled' },
        }),
      ],
    },
  }),
]
```

`getValueFromEvent` 用于从自定义组件事件参数中提取字段值；默认取事件第一个参数。常规 Element Plus `v-model` 组件不需要配置它。
