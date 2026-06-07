# RuntimeConfigForm组件文档

## 用途

`RuntimeConfigForm` 指 `@moluoxixi/config-form-runtime` 导出的无头运行时 `ConfigForm`，用于通过 runtime 注册组件、字段插件、Zod schema、自定义校验和 render 函数构建配置表单。组件来源为 `packages/ConfigForm/runtime`。

## 引入

```ts
import { ConfigForm, defineField, defineFields } from '@moluoxixi/config-form-runtime'
import type { ConfigFormProps, ConfigFormExpose } from '@moluoxixi/config-form-runtime'
```

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| namespace | `string` | `cf` | 否 | CSS 类名前缀。 |
| inline | `boolean` | `false` | 否 | 是否以内联模式渲染字段。 |
| columns | `number` | `24` | 否 | 非 inline 模式下的 grid 列数。 |
| gap | `string` | `8px 8px` | 否 | 布局间距。 |
| fields | `FormNodeConfig[]` | 无 | 是 | 表单字段和容器节点配置。 |
| labelWidth | `string \| number` | `undefined` | 否 | 传递给字段布局的 label 宽度。 |
| defaultValues | `Partial<T>` | `undefined` | 否 | 初始值快照，仅在创建和 reset 时使用。 |
| runtime | `FormRuntimeOptions` | 默认 runtime | 否 | 组件注册、字段插件生命周期和只读适配配置。 |

## 事件与回调

| 名称 | 触发时机 |
|---|---|
| submit | 整表校验通过后触发，值已执行字段 `transform`。 |
| error | 校验失败后触发，参数为字段维度错误对象。 |

## 插槽或 Children

| 名称 | 说明 |
|---|---|
| fields[].slots | 节点配置中的 slot 内容，可使用普通节点配置、render 函数或数组。 |
| RenderFunction | render 函数第一个参数为 `RenderContext`，包含 values、errors、attrs、slots 和表单 API。 |

## 状态

- `useForm` 维护 values、errors、可见性、禁用态、只读态和校验。
- `runtime.transformField` 在渲染前解析组件、默认值、slot 和插件配置。
- `validateField` 默认按 `submit` 触发语义校验，也可显式指定 `blur/change`。
- `reset` 重置为 `defaultValues` 并清理校验错误。

## 可访问性

运行时只提供表单布局和上下文，真实字段组件需要自行承担 label、输入控件、错误提示和键盘交互。使用 render 函数时应保留传入的 `attrs` 与必要的可访问属性。

## 示例

```vue
<ConfigForm
  ref="formRef"
  :fields="fields"
  :default-values="{ name: '' }"
  @submit="handleSubmit"
  @error="handleError"
/>
```

## 测试建议

覆盖默认值、字段写回、Zod schema、自定义 validator、隐藏/禁用/只读提交语义、slot render、runtime component 注册、reset 和单字段校验。

## 变更记录

- 2026-06-07：根据 runtime 源码和类型生成组件契约文档。
