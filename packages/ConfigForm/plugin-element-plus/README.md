# @moluoxixi/config-form-plugin-element-plus

Element Plus 的 ConfigForm 运行时适配插件。它负责两件事：

1. 把 Element Plus 字段组件映射到 ConfigForm 的默认绑定协议。
2. 通过 `readonlyAdapters` 提供只读展示映射，核心不做组件适配。

## 使用

```ts
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
