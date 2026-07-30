# @moluoxixi/config-form-plugin-element-plus

Element Plus 的 ConfigForm runtime adapter。它只负责组件级只读展示映射：

- 通过 `readonlyAdapters` 把 select、tree、cascader、checkbox、radio、switch、color 等值映射成适合阅读的文本或色块。
- 编辑绑定继续使用 ConfigForm 默认的 `modelValue/update:modelValue`，本 adapter 不注册组件，也不提供 `getDefaultField`。

## 使用

```vue
<script setup lang="ts">
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { createElementPlusPlugin } from '@moluoxixi/config-form-plugin-element-plus'
import { ElSelectV2 } from 'element-plus'

const runtime = {
  plugins: [createElementPlusPlugin()],
} satisfies FormRuntimeOptions

const fields = [
  defineField({
    field: 'role',
    component: ElSelectV2,
    readonly: true,
    props: {
      options: [
        { label: '管理员', value: 'admin' },
        { label: '用户', value: 'user' },
      ],
    },
  }),
]
</script>

<template>
  <ConfigForm :fields="fields" :runtime="runtime" />
</template>
```

## 只读适配器

内置只读适配器覆盖常见输入、选择、开关、评分、颜色和时间类组件：

- `ElInput`
- `ElInputNumber`
- `ElSelect`
- `ElSelectV2`
- `ElAutocomplete`
- `ElTreeSelect`
- `ElCascader`
- `ElCheckbox`
- `ElCheckboxGroup`
- `ElRadio`
- `ElRadioGroup`
- `ElSwitch`
- `ElRate`
- `ElDatePicker`
- `ElTimePicker`
- `ElTimeSelect`
- `ElColorPicker`

选择类组件会优先按 `options`、`data` 和 slot 里的选项节点映射文案；多选值会按 `、` 拼接。`ElColorPicker` 会额外渲染一个颜色块，方便只读展示时快速识别色值。

## 覆盖默认适配

```ts
createElementPlusPlugin({
  readonlyAdapters: {
    ElSelectV2: ({ value }) => `role:${String(value)}`,
  },
})
```
