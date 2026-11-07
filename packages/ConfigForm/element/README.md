# ElementConfigForm

`@moluoxixi/config-form-element` 是面向 Element Plus 输入组件的轻量配置表单。
用于开发者直接编写 TypeScript 配置，不需要设计器、项目 JSON 或编译器。

```sh
pnpm add @moluoxixi/config-form-element @moluoxixi/config-form-headless vue element-plus zod@^3
```

- 根节点使用原生 `<form>`，字段使用包内自有 label/control/error 壳；
- inline 布局使用原生 Flex，grid 布局使用原生 CSS Grid；
- 字段默认通过 `modelValue` + `update:modelValue` 写回外部模型；
- 校验、reset、submit 和 readonly 语义统一由 `@moluoxixi/config-form-headless` 提供；`validateOn` 控制 change/blur 校验触发且 submit 校验始终启用；适配器同时透传独立的 dirty/touched 状态、`metaChange`、默认 slot `meta` 及 `getMeta` / `getFieldMeta` / `setTouched`。

组件不使用 `ElForm`、`ElFormItem`、`ElRow`、`ElCol` 或 Element Plus `rules`。`formAttrs` 传给原生 form，`layoutAttrs` / `cellAttrs` 分别传给原生布局和 grid cell div；布局由 `columns`、`gap`、`fieldSpan` 和字段 `span` 控制。

```vue
<script setup lang="ts">
import { createConfigFormModel, defineFields } from '@moluoxixi/config-form-headless'
import { ElementConfigForm } from '@moluoxixi/config-form-element'
import '@moluoxixi/config-form-element/styles'
import { ElInput, ElTag } from 'element-plus'
import 'element-plus/dist/index.css'
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
    id: 'name',
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
const modelPort = createConfigFormModel(model)
</script>

<template>
  <ElementConfigForm
    :model="modelPort"
    :fields="fields"
    :form-attrs="{ autocomplete: 'off' }"
    :columns="12"
    gap="16px"
  />
</template>
```

## 语义组件注册

适配器内置 `text`、`textarea`、`number`、`boolean` 和 `select` 别名，因此 schema 可以直接写 `component: 'text'`。`components` prop 可注册业务别名或覆盖同名默认项；完整注册项还可提供默认 props 和绑定协议，字段上的显式配置优先。

内置别名分别定义在 `src/materials/<name>.ts`，由构建期文件扫描生成 `ELEMENT_CONFIG_FORM_COMPONENTS`。`ELEMENT_CONFIG_FORM_MATERIAL_REGISTRY` 可用于检查物料来源与确定性顺序；业务扩展仍通过 `components` prop 注册，不依赖扫描器。

```ts
const fields = [defineField({ id: 'name', component: 'text', field: 'name', label: '姓名' })]
```

节点的 `extensions` 供设计器和业务插件读取，不会透传给 Element Plus 组件或 DOM。

## 提交与业务接入

每个节点必须有稳定且唯一的 `id`；字段的 `field` 是模型中的键，两者职责不同。
上例的 `modelPort` 是唯一模型端口，更新 `model.value` 即可回显服务端数据。
提交先校验，通过后触发 `submit` 事件；接口请求、保存中状态和服务端错误由宿主管理。
`actions` 插槽提供 `model`、`meta`、`validating`、`submit()` 和 `resetFields()`：

```vue
<ElementConfigForm :model="modelPort" :fields="fields" @submit="saveUser">
  <template #actions="{ resetFields }">
    <ElButton native-type="submit" type="primary">保存</ElButton>
    <ElButton native-type="button" @click="resetFields">重置</ElButton>
  </template>
</ElementConfigForm>
```

`saveUser(values)` 使用校验后的提交值调用业务服务；`ElButton` 由宿主导入或注册。
字段条件可直接写 `visible: values => ...`，组件事件写在 `props.onX`，异步校验使用
`validator(value, values)`。这些都是普通代码，不需要转换成设计器 JSON。

## 节点与布局

包含 `field` 的节点绑定模型并参与 Headless 生命周期；没有 `field` 的节点是纯容器。配置化 slots 会递归处理，render-function slot 只负责自定义渲染。

`visible`、`hidden`、`disabled`、`readonly` 和 `required` 支持布尔值或 `(values) => boolean`。readonly 字段跳过校验但保留提交值。

inline 布局不消费 `span` / `cellAttrs`；grid 布局将 `span` 映射到 CSS Grid，并把 `cellAttrs` 作为原生 div attributes。`getValueFromEvent` 可覆盖默认的首参数取值逻辑。
