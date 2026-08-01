# ConfigForm Headless

`@moluoxixi/config-form-headless` 是轻量 ConfigForm 的共享字段协议和表单内核。它不渲染 DOM，也不依赖 Element Plus、Ant Design Vue 或 shadcn-vue 的 Form/FormItem。

本版 Headless 负责：

- 配置节点、递归 slot、动态 `visible` / `hidden` / `disabled` / `readonly`；
- 受控模型读写、字段默认值、全量或按字段 reset；
- `required`、Zod `schema`、同步或异步 `validator` 和 `validateOn`；
- 标准化 `ConfigFormErrors`、校验状态、异步校验结果防陈旧写回；
- submit 字段筛选、`submitWhenHidden` / `submitWhenDisabled` 和 `transform`；
- 字段级或表单级 `readonlyRender`。

UI 包只负责 Row/Col 布局、自有字段壳、错误和 readonly 展示，以及真实输入组件的值/事件绑定。

```ts
import { createConfigFormController, defineFields } from '@moluoxixi/config-form-headless'
import { h } from 'vue'
import { z } from 'zod'

interface UserForm {
  name: string
  locked: boolean
}

const { defineField } = defineFields<UserForm>()
const fields = [
  defineField({
    component: 'input',
    field: 'name',
    label: '姓名',
    required: true,
    schema: z.string().trim().min(2, '姓名至少 2 个字符'),
    validateOn: ['blur', 'change'],
    readonly: values => values.locked,
    readonlyRender: ({ value }) => h('strong', String(value || '-')),
  }),
]
```

`createConfigFormController` 提供 `getValues`、`setValue(s)`、`validate`、`validateField`、`clearValidate`、`resetFields`、`submit`、`getErrors` 和 validating 状态查询。Zod 和业务 validator 都在 Headless 执行，不再委托 UI 库 rules。

## Readonly

本版不单独暴露 `readPretty`。`readonly` 表示完整展示态：不渲染或绑定编辑组件、跳过校验、仍保留提交值。展示函数优先级为字段 `readonlyRender`、表单 `readonlyRender`、内置原始值 fallback。

## 本版边界

本版只支持顶层对象字段，不包含嵌套路径、数组字段管理、dirty/touched、reaction、远程 DSL 或框架无关运行时。跨字段校验通过字段 `validator(value, values)` 完成。
