<script setup lang="ts">
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { reactive, ref } from 'vue'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { createAntdVuePlugin } from '@moluoxixi/config-form-plugin-antd-vue'
import { CheckboxGroup } from 'ant-design-vue/es/checkbox'
import Input from 'ant-design-vue/es/input'
import { RadioGroup } from 'ant-design-vue/es/radio'
import Select from 'ant-design-vue/es/select'
import Switch from 'ant-design-vue/es/switch'
import { z } from 'zod'

const formRef = ref()
const submittedValues = reactive<Record<string, unknown>>({})

const runtimeOptions = {
  plugins: [createAntdVuePlugin()],
} satisfies FormRuntimeOptions

const fields = [
  defineField({
    field: 'title',
    label: '标题',
    component: Input,
    defaultValue: 'ConfigForm 只读展示',
    readonly: true,
    schema: z.string().optional(),
  }),
  defineField({
    field: 'role',
    label: '角色',
    component: Select,
    defaultValue: 'admin',
    readonly: true,
    schema: z.string().optional(),
    props: {
      options: [
        { label: '管理员', value: 'admin' },
        { label: '用户', value: 'user' },
        { label: '访客', value: 'guest' },
      ],
    },
  }),
  defineField({
    field: 'permissions',
    label: '权限',
    component: CheckboxGroup,
    defaultValue: ['read', 'write'],
    readonly: true,
    schema: z.array(z.string()).optional(),
    props: {
      options: [
        { label: '读', value: 'read' },
        { label: '写', value: 'write' },
        { label: '审', value: 'audit' },
      ],
    },
  }),
  defineField({
    field: 'status',
    label: '状态',
    component: RadioGroup,
    defaultValue: 'enabled',
    readonly: true,
    schema: z.string().optional(),
    props: {
      options: [
        { label: '启用', value: 'enabled' },
        { label: '停用', value: 'disabled' },
      ],
    },
  }),
  defineField({
    field: 'published',
    label: '发布状态',
    component: Switch,
    defaultValue: true,
    readonly: true,
    schema: z.boolean().optional(),
    props: {
      checkedChildren: '已发布',
      unCheckedChildren: '未发布',
    },
  }),
]

function onSubmit(values: Record<string, unknown>) {
  Object.assign(submittedValues, values)
}
</script>

<template>
  <div>
    <ConfigForm
      ref="formRef"
      :fields="fields"
      namespace="moluoxixi"
      :runtime="runtimeOptions"
      label-width="96px"
      @submit="onSubmit"
    />

    <div class="demo-actions">
      <a-button type="primary" @click="formRef?.submit()">
        提交
      </a-button>
      <a-button @click="formRef?.validate()">
        校验
      </a-button>
      <a-button @click="formRef?.reset()">
        重置
      </a-button>
    </div>

    <a-divider>提交值快照</a-divider>
    <pre class="value-preview">{{ JSON.stringify(submittedValues, null, 2) }}</pre>
  </div>
</template>

<style lang="scss">
.demo-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}

.value-preview {
  background: #fafafa;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.6;
  max-height: 300px;
  overflow: auto;
}
</style>
