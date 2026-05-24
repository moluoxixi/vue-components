<script setup lang="ts">
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { reactive, ref } from 'vue'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { createElementPlusPlugin } from '@moluoxixi/config-form-plugin-element-plus'
import {
  ElCheckboxGroup,
  ElColorPicker,
  ElInput,
  ElRadioGroup,
  ElSelectV2,
  ElSwitch,
} from 'element-plus'
import { z } from 'zod'

const formRef = ref()
const submittedValues = reactive<Record<string, unknown>>({})

const runtimeOptions = {
  plugins: [createElementPlusPlugin()],
} satisfies FormRuntimeOptions

const fields = [
  defineField({
    field: 'title',
    label: '标题',
    component: ElInput,
    defaultValue: 'ConfigForm 只读展示',
    readonly: true,
    schema: z.string().optional(),
  }),
  defineField({
    field: 'role',
    label: '角色',
    component: ElSelectV2,
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
    component: ElCheckboxGroup,
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
    component: ElRadioGroup,
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
    component: ElSwitch,
    defaultValue: true,
    readonly: true,
    schema: z.boolean().optional(),
    props: {
      activeText: '已发布',
      inactiveText: '未发布',
    },
  }),
  defineField({
    field: 'themeColor',
    label: '主题色',
    component: ElColorPicker,
    defaultValue: '#409EFF',
    readonly: true,
    schema: z.string().optional(),
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
      :runtime="runtimeOptions"
      label-width="96px"
      @submit="onSubmit"
    />

    <div class="demo-actions">
      <el-button type="primary" @click="formRef?.submit()">
        提交
      </el-button>
      <el-button @click="formRef?.validate()">
        校验
      </el-button>
      <el-button @click="formRef?.reset()">
        重置
      </el-button>
    </div>

    <el-divider>提交值快照</el-divider>
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
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.6;
  max-height: 300px;
  overflow: auto;
}
</style>
