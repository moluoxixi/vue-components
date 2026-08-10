# AntdConfigForm

`@moluoxixi/config-form-antd-vue` 是面向 Ant Design Vue 输入组件的轻量配置表单。

根节点使用原生 `<form>`，字段使用共享 label/control/error 壳；inline 布局使用原生 Flex，grid 布局使用原生 CSS Grid。组件不使用 `AForm`、`AFormItem`、`ARow`、`ACol` 或 Ant Design Vue rules。

字段默认通过 `value` + `update:value` 写回模型；Switch、Checkbox 等组件由包内 binding 映射到 `checked` + `update:checked`。校验、reset、submit 和 readonly 由 `@moluoxixi/config-form-headless` 统一处理，支持 `required`、Zod `schema`、异步 `validator`、`validateOn` 和 `readonlyRender`。`validateOn` 控制 change/blur 校验触发且 submit 校验始终启用；适配器同时透传独立的 dirty/touched 状态、`metaChange`、默认 slot `meta` 及 `getMeta` / `getFieldMeta` / `setTouched`。

`formAttrs` 只接收原生 form attributes，不能传 `labelCol` / `wrapperCol`。`layoutAttrs` / `cellAttrs` 分别传给原生布局和 grid cell div；布局由 `columns`、`gap`、`fieldSpan` 和字段 `span` 控制。

```ts
import { defineFields } from '@moluoxixi/config-form-headless'
import { Input as AInput } from 'ant-design-vue'
import { z } from 'zod'

interface ProjectForm {
  name: string
  published: boolean
}

const { defineField } = defineFields<ProjectForm>()
const fields = [
  defineField({
    component: AInput,
    field: 'name',
    label: '项目名称',
    required: true,
    schema: z.string().trim().min(1, '请输入项目名称'),
    validateOn: 'blur',
    readonly: values => values.published,
  }),
]
```

## 语义组件注册

适配器内置 `text`、`textarea`、`number`、`boolean`、`select` 和 `segmented` 别名，并为 Ant Design Vue 提供对应的 `value` / `checked` 绑定协议。调用方可通过 `components` 注册业务组件或覆盖同名默认项。

```ts
const fields = [
  defineField({ component: 'text', field: 'name' }),
  defineField({ component: 'boolean', field: 'published' }),
]
```

节点的 `extensions` 会保留给 slot、readonly 和业务扩展消费，但不会作为组件 props 或 DOM attributes 输出。

配置化 slots 会递归处理字段与容器节点。inline 布局不消费 `span` / `cellAttrs`；grid 布局将 `span` 映射到 CSS Grid，并把 `cellAttrs` 作为原生 div attributes。
