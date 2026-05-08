# @moluoxixi/config-form

一个轻量的 Vue 3 配置化表单组件库，使用 Zod 和字段级配置完成渲染、校验、显隐、禁用和提交转换。

## 特性

- 配置驱动：通过 `fields` 数组声明表单字段。
- UI 框架无关：支持 Vue 组件、函数式组件、原生标签和 runtime 组件注册。
- Zod + 自定义校验：字段支持 `schema`，也支持读取全量 values 的 `validator`。
- 双向绑定：支持 `modelValue` / `v-model` 初始化和外部更新。
- 灵活布局：内置 24 栅格和 inline 模式，并包含基础移动端适配。
- 可发布样式：SCSS 使用命名空间变量，便于在业务侧覆盖。

## 安装

```bash
pnpm add @moluoxixi/config-form zod
```

## 快速开始

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { z } from 'zod'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import MyInput from './MyInput.vue'

interface LoginForm {
  username: string
  password: string
  confirm: string
}

const formRef = ref()
const model = ref<LoginForm>({ username: 'Ada', password: '', confirm: '' })

const fields = [
  defineField<LoginForm>({
    field: 'username',
    label: '用户名',
    schema: z.string().min(2, '至少 2 个字符'),
    span: 12,
    component: MyInput,
    props: { placeholder: '请输入' },
    validateOn: ['blur', 'change'],
  }),
  defineField<LoginForm>({
    field: 'password',
    label: '密码',
    schema: z.string().min(6, '至少 6 个字符'),
    span: 12,
    component: MyInput,
    props: { type: 'password' },
  }),
  defineField<LoginForm>({
    field: 'confirm',
    label: '确认密码',
    component: MyInput,
    span: 12,
    validator: (value, values) =>
      value === values.password ? undefined : '两次密码不一致',
  }),
]

function onSubmit(values: LoginForm) {
  console.log('提交', values)
}
</script>

<template>
  <ConfigForm
    ref="formRef"
    v-model="model"
    :fields="fields"
    label-width="80px"
    @submit="onSubmit"
  />
</template>
```

## ConfigForm Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `namespace` | `string` | `'cf'` | 运行时 CSS 类名前缀 |
| `inline` | `boolean` | `false` | 行内布局模式 |
| `fields` | `FormNodeConfig[]` | - | 字段/容器配置数组；`defineField` 返回纯配置 |
| `labelWidth` | `string \| number` | - | 标签宽度，number 自动转 px |
| `modelValue` | `Record<string, unknown>` | - | 表单值，支持 `v-model`；传泛型后为对应表单类型 |
| `runtime` | `FormRuntimeOptions` | - | DIY 运行时配置，用于组件注册和字段转换插件 |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `submit` | `Record<string, unknown>` | 校验通过后提交的字段值；传泛型后为对应表单类型 |
| `error` | `FormErrors` | 校验失败时的错误信息 |
| `update:modelValue` | `Record<string, unknown>` | 内部值变化时触发；传泛型后为对应表单类型 |

## Expose

| Method | Returns | Description |
|--------|---------|-------------|
| `submit()` | `Promise<boolean>` | 校验通过后触发 `submit` |
| `validate()` | `Promise<boolean>` | 校验整个表单 |
| `validateField(field, trigger?)` | `Promise<boolean>` | 校验指定字段 |
| `reset()` | `void` | 重置为字段默认值并清空错误 |
| `setValue(field, value)` | `void` | 设置单个字段值 |
| `setValues(values, replace?)` | `void` | 批量设置字段值 |
| `getValue(field)` | `unknown` | 获取单个字段值；传泛型后可按字段 key 推导 |
| `getValues()` | `Record<string, unknown>` | 获取浅拷贝快照；传泛型后为对应表单类型 |
| `clearValidate(field?)` | `void` | 清除指定字段错误；不传则清除全部 |

## Field 配置

`defineField` 会优先从 `schema` 和 `defaultValue` 推导当前字段值类型；没有可推导来源时，字段值默认为 `unknown`。它只返回普通配置对象，不写入 symbol、隐藏属性或 defineProperty 标记。所有字段默认值、组件注册、插件转换和 slot 内节点递归处理都由 `ConfigForm` 根组件统一完成。字段配置彼此独立，`validator` 的第二个参数是当前表单 values 快照，可用于必要的跨字段校验。

如果需要把字段配置和业务模型绑定，把表单模型作为 `defineField<TValues>(...)` 的泛型传入。此时 `field` 会被限制为 `TValues` 的字符串 key，并且 `defaultValue`、`validator`、`transform`、`visible`、`disabled` 中的字段值和全量 values 使用同一个模型类型：

```ts
interface LoginForm {
  username: string
  remember: boolean
}

const fields = [
  defineField<LoginForm>({
    field: 'username',
    component: MyInput,
    defaultValue: '',
    validator: (value, values) =>
      values.remember && value.length === 0 ? '请输入用户名' : undefined,
  }),
]
```

同一个表单内所有真实字段的 `field` 必须唯一；重复字段名会直接抛错，避免值、校验错误、显隐和禁用状态被覆盖。

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `field` | `string` | - | 字段名，作为 values 的 key |
| `label` | `RuntimeText` | - | 字段标签字符串 |
| `schema` | `ZodTypeAny` | - | 字段 Zod 校验 |
| `validator` | `(value, values) => string \| string[] \| void \| Promise` | - | 自定义校验，可访问全量 values |
| `span` | `number` | `24` | 非 inline 模式下的 24 栅格跨度 |
| `component` | `Component \| Function \| string` | - | 实际渲染组件 |
| `props` | `Record<string, unknown>` | - | 传给组件的 props |
| `defaultValue` | `unknown` | `undefined` | 默认值；会参与 `defineField` 字段值推导 |
| `valueProp` | `string` | `'modelValue'` | 注入组件的值 prop |
| `trigger` | `string` | `'update:modelValue'` | 接收组件值变化的事件名 |
| `getValueFromEvent` | `(...args) => unknown` | 第一个事件参数 | 从组件事件参数中提取字段值；原生 `input` 可从 `event.target.value` 取值 |
| `blurTrigger` | `string` | `'blur'` | blur 校验事件名 |
| `validateOn` | `'submit' \| 'blur' \| 'change' \| array` | `'submit'` | 校验触发时机，始终包含 submit |
| `visible` | `boolean \| (values) => boolean` | - | 动态显隐 |
| `disabled` | `boolean \| (values) => boolean` | - | 动态禁用 |
| `transform` | `(value, values) => unknown` | - | submit 前转换值 |
| `submitWhenHidden` | `boolean` | `false` | 隐藏字段是否仍提交 |
| `submitWhenDisabled` | `boolean` | `false` | 禁用字段是否仍提交 |
| `slots` | `Record<string, SlotContent>` | - | 传给组件的插槽；支持文本、渲染函数、普通对象配置、由 `defineField` 创建的容器组件节点或真实字段节点数组 |

`slots` 中的对象配置可以是普通 config，也可以通过 `defineField(...)` 创建。`ConfigForm` 会统一递归处理这些配置，并按是否存在 `field` 区分语义：没有 `field` 的节点是容器/子组件，只渲染组件本体和插槽；存在 `field` 的节点是真实表单字段，会绑定表单值、校验、label 和错误展示。Radio / Checkbox 这类子组件通常不需要 `field`：

如果 slot 渲染函数返回真实字段节点，字段拓扑会在表单初始化时用空 scope 收集一次；因此 `field`、`defaultValue`、`schema`、`validator`、显隐/禁用和提交相关选项必须不依赖运行时 slot scope。实际渲染内容仍会在组件渲染时接收真实 scope。

```ts
defineField({
  field: 'gender',
  label: '性别',
  component: RadioGroup,
  slots: {
    default: [
      defineField({ component: Radio, props: { value: 'male' }, slots: { default: '男' } }),
      defineField({ component: Radio, props: { value: 'female' }, slots: { default: '女' } }),
    ],
  },
})
```

## DIY Runtime

`runtime` 是表单的开放扩展边界。字段始终是普通配置对象，`ConfigForm` 根组件会在渲染、校验和提交前统一递归处理顶层字段和 slots 内字段。处理后的字段再交给内部组件消费，表单状态通过 context provide 下发 `values`、`errors`、`getValue`、`setValue`、`visibilityMap`、`disabledMap` 等能力。

字段处理管线固定为：

1. `resolveField(field)` 只补内置默认值，不执行插件。
2. `transformField(field)` 先执行 `resolveField(field)`，再按用户注册顺序执行插件 `transformField(field)`。
3. runtime 恢复用户在原字段上显式声明的顶层配置和 props，确保优先级为 `用户 > 插件 > 内置默认值`。
4. runtime 解析已注册组件，并继续递归转换 slots 内的普通对象配置或 `defineField(...)` 配置。

```vue
<script setup lang="ts">
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { createI18nPlugin } from '@moluoxixi/config-form-plugin-i18n'
import MyInput from './MyInput.vue'

const runtimeOptions = {
  components: {
    MyInput,
  },
  plugins: [
    createI18nPlugin({
      locale: 'zh-CN',
      messages: {
        'zh-CN': {
          'field.username': '用户名{required}',
          'field.username.placeholder': '请输入用户名',
        },
      },
      fields: {
        username: {
          label: {
            key: 'field.username',
            defaultMessage: '用户名',
            params: { required: ' *' },
          },
          props: {
            placeholder: {
              key: 'field.username.placeholder',
              defaultMessage: '请输入用户名',
            },
          },
        },
      },
    }),
    {
      name: 'audit',
      transformField: field => 'field' in field
        ? {
            ...field,
            props: {
              ...field.props,
              'data-field': field.field,
            },
          }
        : undefined,
    },
  ],
} satisfies FormRuntimeOptions

const fields = [
  defineField({
    field: 'username',
    component: 'MyInput',
    visible: values => values.role !== 'guest',
  }),
]
</script>

<template>
  <ConfigForm :fields="fields" :runtime="runtimeOptions" />
</template>
```

`<ConfigForm>` 的 `runtime` prop 只接收 `FormRuntimeOptions`，组件内部会创建实际 runtime 实例。插件测试、底层解析和非组件场景应从 `@moluoxixi/config-form/plugins` 使用 `createFormRuntime(options)`，避免把插件专用能力混入根入口。

扩展点：

- `components`：注册字符串组件 key，字段中可直接写 `component: 'MyInput'`；大写 key 未注册会抛错，原生标签如 `'input'` 可直接使用。
- `plugins`：按用户注册顺序收集组件和 `transformField(field)` hook；hook 只接收已补齐内置默认值的 field，不接收 values/errors/slot scope。
- 字段转换：插件可返回新的字段配置或 `undefined`；返回非法值、修改字段 key、重复插件名或重复组件 key 都会直接抛错。
- 官方插件包：例如 `@moluoxixi/config-form-plugin-i18n`，通过插件 `fields` 映射补 label、props 和 slots 文案；没有命中当前语言文案或默认文案时会抛错，`missing` 仅用于通知/诊断。

## 样式

默认命名空间是 `cf`。如果只使用默认样式：

```ts
import '@moluoxixi/config-form/styles'
```

自定义命名空间时，运行时 prop 和 SCSS 变量需要保持一致：

```scss
@use '@moluoxixi/config-form/styles' with (
  $namespace: 'my-form'
);
```

```vue
<ConfigForm namespace="my-form" />
```

## License

MIT
