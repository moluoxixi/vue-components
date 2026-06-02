# @moluoxixi/config-form

一个轻量的 Vue 3 配置化表单组件库，使用 Zod 和字段级配置完成渲染、校验、显隐、禁用和提交转换。

## 特性

- 配置驱动：通过 `fields` 数组声明表单字段。
- UI 框架无关：支持 Vue 组件、函数式组件、原生标签和 runtime 组件注册。
- Zod + 自定义校验：字段支持 `schema`，也支持读取全量 values 的 `validator`。
- 初始值快照：通过 `defaultValues` 提供初始值，内部值通过表单 ref API 读取和修改。
- 只读展示：字段级 `readonly` 与 `readonlyAdapters` 分离，核心只负责状态和渲染分派，具体展示值由插件提供。
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
import { ConfigForm, defineFields, type ConfigFormExpose } from '@moluoxixi/config-form'
import MyInput from './MyInput.vue'

interface LoginForm {
  username: string
  password: string
  confirm: string
}

const formRef = ref<ConfigFormExpose<LoginForm>>()
const defaultValues: Partial<LoginForm> = { username: 'Ada', password: '', confirm: '' }
const { defineField } = defineFields<LoginForm>()

const fields = [
  defineField({
    field: 'username',
    label: '用户名',
    required: true,
    requiredMessage: '请输入用户名',
    schema: z.string().min(2, '至少 2 个字符'),
    span: 12,
    component: MyInput,
    props: { placeholder: '请输入' },
    validateOn: ['blur', 'change'],
  }),
  defineField({
    field: 'password',
    label: '密码',
    schema: z.string().min(6, '至少 6 个字符'),
    span: 12,
    component: MyInput,
    props: { type: 'password' },
  }),
  defineField({
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
    :default-values="defaultValues"
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
| `defaultValues` | `Partial<Record<string, unknown>>` | - | 表单初始值快照；传泛型后为对应表单类型 |
| `runtime` | `FormRuntimeOptions` | - | DIY 运行时配置，用于组件注册和字段转换插件 |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `submit` | `Record<string, unknown>` | 校验通过后提交的字段值；传泛型后为对应表单类型 |
| `error` | `FormErrors` | 校验失败时的错误信息 |

## Expose

| Method | Returns | Description |
|--------|---------|-------------|
| `submit()` | `Promise<boolean>` | 校验通过后触发 `submit` |
| `validate()` | `Promise<boolean>` | 校验整个表单 |
| `validateField(field, trigger?)` | `Promise<boolean>` | 校验指定字段 |
| `reset()` | `void` | 重置为 `defaultValues` 初始快照和字段默认值并清空错误 |
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

如果想先把模型类型绑定到一个局部工厂，再从里面解构 `defineField` 复用同一份模型约束，可以先调用 `defineFields<TValues>()`：

```ts
const { defineField: defineLoginField } = defineFields<LoginForm>()

const fields = [
  defineLoginField({
    field: 'username',
    component: MyInput,
    defaultValue: '',
    validator: (value, values) =>
      values.remember && value.length === 0 ? '请输入用户名' : undefined,
  }),
  defineLoginField({
    field: 'remember',
    component: MySwitch,
    defaultValue: false,
  }),
] as const
```

同一个表单内所有真实字段的 `field` 必须唯一；重复字段名会直接抛错，避免值、校验错误、显隐和禁用状态被覆盖。

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `field` | `string` | - | 字段名，作为 values 的 key |
| `label` | `RuntimeText` | - | 字段标签字符串 |
| `required` | `boolean \| (values) => boolean` | `false` | 是否显示必填标识并执行空值校验 |
| `requiredMessage` | `RuntimeText` | `必填` | 必填校验失败时展示的错误文案 |
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
| `readonly` | `boolean \| (values) => boolean` | - | 动态只读；只读字段跳过校验但仍参与提交 |
| `transform` | `(value, values) => unknown` | - | submit 前转换值 |
| `submitWhenHidden` | `boolean` | `false` | 隐藏字段是否仍提交 |
| `submitWhenDisabled` | `boolean` | `false` | 禁用字段是否仍提交 |
| `slots` | `Record<string, SlotContent>` | - | 传给组件的插槽；仅支持普通对象配置、由 `defineField` 创建的容器组件节点或真实字段节点数组 |

`slots` 中的对象配置可以是普通 config，也可以通过 `defineField(...)` 创建。`ConfigForm` 会统一递归处理这些配置，并按是否存在 `field` 区分语义：没有 `field` 的节点是容器/子组件，只渲染组件本体和插槽；存在 `field` 的节点是真实表单字段，会绑定表单值、校验、label 和错误展示。Radio / Checkbox 这类子组件通常不需要 `field`：

slot 内容与顶层 `fields` 采用同一声明模式，不支持文本、VNode 或渲染函数。需要展示简单文本时，用一个普通节点配置承载文本 props，例如原生 `span` 的 `textContent`。

```ts
defineField({
  field: 'gender',
  label: '性别',
  required: true,
  requiredMessage: '请选择性别',
  component: RadioGroup,
  slots: {
    default: [
      defineField({
        component: Radio,
        props: { value: 'male' },
        slots: {
          default: defineField({
            component: 'span',
            props: { textContent: '男' },
          }),
        },
      }),
      defineField({
        component: Radio,
        props: { value: 'female' },
        slots: {
          default: defineField({
            component: 'span',
            props: { textContent: '女' },
          }),
        },
      }),
    ],
  },
})
```

## DIY Runtime

`runtime` 是表单的开放扩展边界。这里的 transform 指字段配置转换管线，不是字段提交值的 `transform(value, values)`。字段始终是普通配置对象，`ConfigForm` 根组件会在渲染、校验和提交前统一递归处理顶层字段和 slots 内字段。处理后的字段再交给内部组件消费，表单状态通过 context provide 下发 `values`、`errors`、`getValue`、`setValue`、`visibilityMap`、`disabledMap` 等能力。

字段处理管线固定为：

1. `getFieldDefaults(field)` 只返回内置默认配置片段，不合并用户字段声明，也不执行插件。
2. `transformField(field)` 将内置默认片段应用到字段后，再按用户注册顺序执行插件 `transformField(field)`。
3. runtime 恢复用户在原字段上显式声明的顶层配置和 props，确保优先级为 `用户 > 插件 > 内置默认值`。
4. runtime 解析已注册组件，并继续递归转换 slots 内的普通对象配置或 `defineField(...)` 配置。

内置默认值插件写在 `src/plugins/builtInFieldDefaults.ts`，只产出默认配置片段，优先级最低；用户插件写在 `runtime.plugins`，只负责 `transformField(field)`。

只读展示由 `runtime.readonlyAdapters` 管理。核心在渲染阶段只负责把当前字段节点、当前值和表单快照交给适配器；如果组件名没有注册适配器，就直接回退到原始值文本，不会把 readonly 语义重新塞回组件 props。

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { useI18n } from 'vue-i18n'
import MyInput from './MyInput.vue'

const { t } = useI18n()

const runtimeOptions = {
  components: {
    MyInput,
  },
  plugins: [
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

const fields = computed(() => [
  defineField({
    field: 'username',
    label: t('field.username'),
    component: 'MyInput',
    props: {
      placeholder: t('field.username.placeholder'),
    },
    visible: values => values.role !== 'guest',
  }),
])
</script>

<template>
  <ConfigForm :fields="fields" :runtime="runtimeOptions" />
</template>
```

`<ConfigForm>` 的 `runtime` prop 只接收 `FormRuntimeOptions`，组件内部会创建实际 runtime 实例。插件测试、底层解析和非组件场景应从 `@moluoxixi/config-form/plugins` 使用 `createFormRuntime(config)`，避免把插件专用能力混入根入口。

扩展点：

- `components`：注册字符串组件 key，字段中可直接写 `component: 'MyInput'`；大写 key 未注册会抛错，原生标签如 `'input'` 可直接使用。
- `plugins`：按用户注册顺序收集组件和 `transformField(field)` hook；hook 只接收已补齐内置默认值的 field，不接收 values/errors/slot scope。
- `readonlyAdapters`：注册字符串组件 key 对应的只读展示适配器；插件可以扩展或覆盖具体组件的展示值，未注册时回退为 raw value 文本。
- 字段转换：插件可返回新的字段配置或 `undefined`；返回非法值、修改字段 key、重复插件名或重复组件 key 都会直接抛错。
- 多语言：在上层 Vue 应用中使用 `vue-i18n` 等成熟库生成 `label`、`props.placeholder`、选项文案和校验消息；`ConfigForm` 只消费最终字段配置，不内置 i18n 插件，也不会递归解析 message key。

## 错误

运行时和插件契约错误会抛出 `ConfigFormError`。它携带稳定 `code` 和结构化 `context`，方便调用方按错误码处理，而不是依赖字符串消息。

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
