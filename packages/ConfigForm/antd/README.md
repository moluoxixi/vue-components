# AntdConfigForm

`@moluoxixi/config-form-antd-vue` 是面向 Ant Design Vue 输入组件的轻量配置表单。

根节点使用原生 `<form>`，字段使用共享 label/control/error 壳；inline 布局使用原生 Flex，grid 布局使用原生 CSS Grid。组件不使用 `AForm`、`AFormItem`、`ARow`、`ACol` 或 Ant Design Vue rules。

字段默认通过 `value` + `update:value` 写回模型；Switch、Checkbox 等组件由包内 binding 映射到 `checked` + `update:checked`。校验、reset、submit 和 readonly 由 `@moluoxixi/config-form-headless` 统一处理，支持 `required`、Zod `schema`、异步 `validator`、`validateOn` 和 `readonlyRender`。

`formProps` 只接收原生 form attributes，不能传 `labelCol` / `wrapperCol`。`rowProps` / `colProps` 分别传给原生布局和 grid cell div；布局由 `columns`、`gap`、`fieldSpan` 和字段 `span` 控制。

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

配置化 slots 会递归处理字段与容器节点。inline 布局不消费 `span` / `colProps`；grid 布局将 `span` 映射到 CSS Grid，并把 `colProps` 作为原生 div attributes。
