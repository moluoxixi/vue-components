# ConfigForm Headless

`@moluoxixi/config-form-headless` 是轻量 ConfigForm 的 Vue headless 字段协议和表单内核。它不渲染 DOM，也不依赖 Element Plus 或 Ant Design Vue 的 Form/FormItem，但公共组件、slot 和 readonly render 契约使用 Vue 类型。

本版 Headless 负责：

- 配置节点、递归 slot、动态 `visible` / `hidden` / `disabled` / `readonly`；
- 受控模型读写、字段默认值、全量或按字段 reset；
- `required`、Zod `schema`、同步或异步 `validator` 和 `validateOn`；
- 与 `validateOn` 独立的字段/表单 `dirty`、`touched` 状态和 `onMetaChange` 通知；
- 标准化 `ConfigFormErrors`、校验状态、异步校验结果防陈旧写回；
- submit 字段筛选、`submitWhenHidden` / `submitWhenDisabled` 和 `transform`；
- 字段级或表单级 `readonlyRender`。
- 可复用的 `ConfigFormComponentRegistry` / `ConfigFormComponentRegistration` 语义组件注册契约；
- 基于命名模块生成组件注册表的 `defineConfigFormComponentMaterial` / `createConfigFormComponentRegistry`；
- 字段和容器节点的 `extensions` 非渲染元数据。
- 可序列化 `reactions` 的稳定值事务，以及字段 state、组件 props 和校验目标投影。

`@moluoxixi/config-form` 根入口导出的 Vue renderer 负责原生 `<form>`、Grid/Flex、字段壳、错误 DOM、ARIA 和递归节点渲染。UI 包只保留真实输入组件的值/事件绑定预设与视觉样式。

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
    extensions: { 'acme.designer': { setter: 'text' } },
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

`extensions` 会保留在字段、容器、slot 和 readonly context 中，但不会自动传给真实组件或 DOM。需要持久化的扩展值应保持 JSON 可序列化并使用业务命名空间。

## 组件物料注册

适配器可以在构建期扫描同名物料文件，再把普通模块映射交给 Headless 注册器。注册器校验文件名与声明名、拒绝重复或危险名称，并按 `order` 和名称稳定排序；它本身不依赖 Vite。

```ts
import { createConfigFormComponentRegistry, defineConfigFormComponentMaterial } from '@moluoxixi/config-form-headless'
import { markRaw } from 'vue'
import MyInput from './MyInput.vue'

const modules = {
  './materials/text.ts': defineConfigFormComponentMaterial({
    name: 'text',
    order: 10,
    value: { component: markRaw(MyInput) },
  }),
}

const components = createConfigFormComponentRegistry(modules)
```

`createConfigFormController` 提供 `getValues`、`setValue(s)`、`validate`、`validateField`、`clearValidate`、`resetFields`、`submit`、`getErrors` 和 validating 状态查询，也提供 `getMeta`、`getFieldMeta`、`setTouched` 与 `setErrors`。`setErrors` 原子替换当前错误并使更早启动的异步校验失效，用于恢复隔离 Runtime 的 validation 快照；相同错误不会重复发布 `onErrorsChange`。`dirty` 表示当前值是否偏离 reset 基准；`touched` 可按全部或指定字段显式设置，submit 会标记当前可交互字段。宿主在 controller 之外整体替换模型后，可调用 `refreshMeta`；替换字段树后调用 `refreshReactions` 会重新执行稳定 reaction 事务并同步 meta。两者与 `validateOn` 的 `change` / `blur` / `submit` 校验触发策略相互独立，且 submit 校验始终启用。Zod 和业务 validator 都在 Headless 执行，不再委托 UI 库 rules。

## Readonly

本版不单独暴露 `readPretty`。`readonly` 表示完整展示态：不渲染或绑定编辑组件、跳过校验、仍保留提交值。展示函数优先级为字段 `readonlyRender`、表单 `readonlyRender`、内置原始值展示。

## 本版边界

本版只支持顶层对象字段，不包含嵌套路径、数组字段管理、异步 reaction、任意脚本表达式或远程 DSL。同步 reaction 的条件、effect 和纯 reducer 由 `@moluoxixi/config-form-core` 提供；Headless 负责把它接入模型、校验和渲染投影。跨字段校验仍可通过字段 `validator(value, values)` 完成；Zod `schema` 的解析结果用于后续 validator，提交值转换需显式配置 `transform`。
