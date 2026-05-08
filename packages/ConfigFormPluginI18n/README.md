# @moluoxixi/config-form-plugin-i18n

ConfigForm 的官方 i18n 字段转换插件。本包不再提供 token API，也不会修改字段对象；它只在 runtime 的 `transformField(field)` 阶段，根据 `fields` 映射为对应字段补充 `label` 和 `props` 文案。

插件不会捕获 `locale`、`translate`、消息函数或 `missing` 里的异常。未解析到当前语言文案且没有 `defaultMessage` 时会直接抛错；`missing` 仅用于通知/诊断，返回值不会替代缺失文案。

```ts
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { defineField } from '@moluoxixi/config-form'
import { createI18nPlugin } from '@moluoxixi/config-form-plugin-i18n'

const runtimeOptions = {
  plugins: [
    createI18nPlugin({
      locale: 'zh-CN',
      messages: {
        'en-US': {
          'field.name': 'Name',
          'field.name.placeholder': 'Enter name',
        },
        'zh-CN': {
          'field.name': '姓名',
          'field.name.placeholder': '请输入姓名',
        },
      },
      fields: {
        name: {
          label: { key: 'field.name', defaultMessage: 'Name' },
          props: {
            placeholder: {
              key: 'field.name.placeholder',
              defaultMessage: 'Enter name',
            },
          },
        },
      },
    }),
  ],
} satisfies FormRuntimeOptions

const field = defineField({
  field: 'name',
  component: 'input',
})
```

## 字段映射

`fields` 按字段名索引。每个字段可配置：

- `label`：字段 label 文案描述。
- `props`：递归解析 props 中的文案描述，适合 placeholder、options.label 等。

文案描述格式为 `{ key, defaultMessage?, params? }`。`params` 只支持静态值，具体字段组件需要表单值时应通过 ConfigForm context 绑定值，而不是通过 i18n 插件读取运行时状态。

```ts
createI18nPlugin({
  locale: () => currentLocale.value,
  messages,
  fields: {
    role: {
      label: { key: 'field.role' },
      props: {
        options: [
          { label: { key: 'role.admin' }, value: 'admin' },
          { label: { key: 'role.user' }, value: 'user' },
        ],
        placeholder: { key: 'field.role.placeholder' },
      },
    },
  },
})
```

`slots` 与正常字段采用同一协议，只允许普通节点配置或 `defineField(...)` 产物；需要多语言 slot 文本时，请把文本放到 slot 子节点的 `props` 中由组件消费。字段原始配置始终优先于插件补充值，因此用户在字段上显式声明的 `label`、`props.placeholder` 等不会被 i18n 插件覆盖。整体优先级保持 `用户 > 插件 > 内置默认值`。
