# @moluoxixi/config-form

Vue 3 配置化表单。所有表单只通过 Headless controller 和 ConfigFormRenderer 执行；ConfigForm 是带字段预处理的薄组件。

## 使用

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import { ConfigForm } from '@moluoxixi/config-form'
import { createConfigFormModel, defineFields } from '@moluoxixi/config-form-headless'
import { ElInput } from 'element-plus'
import { createElementPlusPlugin } from '@moluoxixi/config-form-plugin-element-plus'

const values = shallowRef({ name: '' })
const model = createConfigFormModel(values)
const { defineField } = defineFields<typeof values.value>()
const fields = [
  defineField({ id: 'name', field: 'name', component: ElInput, label: '姓名', required: true, validateOn: ['blur'] }),
]
const runtime = { plugins: [createElementPlusPlugin()] }
</script>

<template>
  <ConfigForm :model="model" :fields="fields" :runtime="runtime" />
</template>
```

## 模型合同

`model` 是必传的同步 `{ read, write }` 端口。可以使用 `createConfigFormModel(ref)`，也可以连接 Vue 响应式 store；`read()` 必须读取响应式状态，`write(next)` 返回前必须能读到新值。异步请求和审核在调用写入前完成。表单不维护模型镜像，不通过 `update:modelValue` 等待父组件确认。

`change`、`fieldChange`、`metaChange`、`errorsChange`、`submit`、`error` 是通知事件。`defaultValues` 定义 reset 基线，`resetFields()` 重置；`setValue`、`setValues`、`getValues`、`validateField`、`validate` 和 `submit` 都使用同一个模型端口。

## 两个入口

- `ConfigFormRenderer` 消费 Headless 字段节点，提供原生 form、响应式 Grid/Flex、ARIA、嵌套 slots、readonly、校验和 reaction。
- `ConfigForm` 在进入 Renderer 前执行 `runtime.plugins`，合并组件绑定默认值、转换字段、解析嵌套节点，并将 readonly adapter 接为字段 `readonlyRender`。它没有第二套状态机。

所有节点必须有稳定 `id`。组件与 slot 函数使用 Vue/Headless 当前合同；slot 上下文包含 `model`、`meta`、`slotProps`，字段 slot 另有 `field`、`value`、`setValue`。不再提供旧 FormLayout、RecursiveField、FormContext 或 useForm 模板链路。

## 插件

`runtime` 接受 `FormRuntimeOptions`，可配置 `components`、`plugins` 与 `readonlyAdapters`。`getDefaultField`、`transformField` 只处理字段配置，不拥有表单值、校验队列或提交行为。字段显式配置优先于注册默认值；未知组件 key、重复插件名及冲突注册会抛出带 code/context 的 `ConfigFormError`。

底层纯预处理 API 从 `@moluoxixi/config-form/plugins` 导入。单独调用 `transformField` 不会执行校验或 reaction。

## 样式与验证

默认命名空间为 `mx-config-form`，默认 columns/fieldSpan 为 24、gap 为 16px。布局规则来自 Core，Designer、Renderer 与 Source 共用。

```ts
import '@moluoxixi/config-form/styles'
```

```bash
pnpm --filter @moluoxixi/config-form test
pnpm --filter @moluoxixi/config-form typecheck
pnpm test:config-form-packages
```
