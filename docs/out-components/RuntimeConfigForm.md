# RuntimeConfigForm组件文档

> 契约状态：第一阶段目标契约已实现并验证（`PASS`，2026-07-17）。

## 用途

`RuntimeConfigForm` 指 `@moluoxixi/config-form` 导出的无头运行时 `ConfigForm`，用于通过 runtime 注册组件、可选 runtime adapter、Zod schema、自定义校验和 render 函数构建配置表单。组件来源为 `packages/ConfigForm/runtime`。

## 引入

```ts
import type { ConfigFormExpose, ConfigFormProps } from '@moluoxixi/config-form'
import { ConfigForm, defineField, defineFields } from '@moluoxixi/config-form'
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
| runtime | `FormRuntimeOptions` | 默认 runtime | 否 | 组件注册、字段 runtime adapter 生命周期和只读适配配置。 |

## 事件与回调

| 名称 | Payload | 触发时机 |
|---|---|---|
| submit | `T` | 整表校验通过后触发，值已执行字段 `transform`。 |
| error | `FormErrors`，即 `Record<string, string[]>` | 校验失败后触发，参数为字段维度错误对象。 |

## 插槽或 Children

| 名称 | 说明 |
|---|---|
| fields[].slots | 节点配置中的 slot 内容，可使用普通节点配置、render 函数或数组。 |
| RenderFunction | render 函数第一个参数为 `RenderContext`，包含 values、errors、attrs、slots 和表单 API。 |
| Vue 函数组件 | 使用 `asVueFunctionalComponent(component)` 显式包装后作为字段组件；未包装函数继续按 ConfigForm render function 处理。 |

## 当前能力

- `useForm` 维护 values、errors、可见性、禁用态、只读态和校验。
- `runtime.transformField` 在渲染前解析组件、默认值、slot 和插件配置。
- `runtime.plugins` 可省略；无 adapter 时仍支持直接组件、原生标签、校验、递归 slot 和 raw readonly fallback。
- `validateField` 默认按 `submit` 触发语义校验，也可显式指定 `blur/change`。
- `reset` 重置为 `defaultValues` 并清理校验错误。

## 本轮契约验证

- `PASS`：新增 `asVueFunctionalComponent(component)`；未包装函数保持 ConfigForm `RenderFunction` 语义。
- `PASS`：表单校验链同时支持同步和异步 Zod schema；独立同步 helper `validateField(value, schema)` 只承担同步 schema。
- `PASS`：字符串组件 alias 保留到 resolved node，并优先用于 readonly adapter 查找。
- `PASS`：表单卸载时取消 pending validation timer，pending Promise 显式拒绝，运行中的异步结果不得写回已卸载表单。
- `PASS`：并发整表与单字段校验按请求私有结果结算，UI 错误按字段只接受最新请求；空字符串字段键保持独立清错语义。
- `PASS`：runtime adapter 的同名组件或 readonly adapter 继续冲突即报错，不静默覆盖。

## Expose

| 方法 | 类型 | 说明 |
|---|---|---|
| submit | `() => Promise<boolean>` | 执行整表校验，并按结果触发 submit/error。 |
| validate | `() => Promise<boolean>` | 按 submit trigger 校验全部字段。 |
| validateField | `(field: string, trigger?: 'submit' \| 'blur' \| 'change') => Promise<boolean>` | 校验单字段；未知字段保持现有 no-op success 语义。 |
| reset | `() => void` | 重置默认值并清空错误。 |
| setValue | `(field: string, value: unknown) => void` | 写入单字段并清理该字段错误。 |
| setValues | `(values: Partial<T>, replace?: boolean) => void` | 合并或替换表单值。 |
| getValue | `(field: string) => unknown` | 读取单字段。 |
| getValues | `() => T` | 返回保留 Date/Dayjs 等实例的浅拷贝。 |
| clearValidate | `(field?: string) => void` | 清理指定字段或全部错误。 |

## 选型边界

- 适合：需要 UI 框架无关 schema、Zod/自定义 validator、readonly adapter、递归配置节点和统一表单语义。
- 不适合：调用方必须直接获得 Element Plus 或 Ant Design Vue 原生 `FormInstance`、原生 rules 对象或受控 `v-model` 时，应选择对应 UI-native 轻量包。
- `MISSING SSR evidence`：当前没有 SSR/hydration 验证材料，不得宣称支持服务端渲染。
- runtime adapter 可选；“无 adapter”不是另一套包，也不消除 runtime 内置字段转换成本。

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

覆盖默认值、字段写回、同步/异步 Zod schema、自定义 validator、隐藏/禁用/只读提交语义、slot render、Vue 函数组件包装、runtime component alias、reset、单字段校验和卸载清理。

## 变更记录

- 2026-07-17：第一阶段实现、测试、类型检查、构建、coverage、lint 与 Playwright 验证通过。
- 2026-07-17：修正真实包名，区分当前能力与目标契约，明确 adapter 可选、函数语义、异步 Zod、Expose 与卸载清理目标。
- 2026-06-07：根据 runtime 源码和类型生成组件契约文档。
