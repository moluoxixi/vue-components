<script lang="ts">
// 示例元信息由 playground 通过 import.meta.glob 读取，用于生成侧栏和页面标题。
export const exampleMeta = {
  name: 'antdConfigForm',
  title: 'antdConfigForm',
  category: '配置表单',
  description: 'components 包内置 Ant Design Vue 配置表单的字段写回、checked 协议自动适配和提交场景。',
  order: 50,
}
</script>

<script setup lang="ts">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import { defineFields } from '@moluoxixi/config-form-headless'
import { antdConfigForm } from '@moluoxixi/components'
import { Button as AButton, Checkbox as ACheckbox, Divider as ADivider, Input as AInput, Tag as ATag } from 'ant-design-vue'
import { computed, h, shallowRef } from 'vue'
import { z } from 'zod'

interface AntdFormValues {
  projectName: string
  publish: boolean
  publishNote: string
}

const formModel = shallowRef<AntdFormValues>({
  projectName: '',
  publish: false,
  publishNote: '',
})
const submittedValues = shallowRef<Partial<AntdFormValues>>({})
const { defineField } = defineFields<AntdFormValues>()

const fields = [
  defineField({
    component: AInput,
    field: 'projectName',
    label: '项目名称',
    props: {
      placeholder: '请输入 Antd 项目名称',
    },
    readonly: values => values.publish,
    readonlyRender: ({ value }) => h(ATag, { color: 'green' }, () => value || '未填写'),
    required: true,
    requiredMessage: '请输入项目名称',
    schema: z.string().trim().min(1, '请输入项目名称'),
    span: 12,
    validateOn: 'blur',
  }),
  defineField({
    component: ACheckbox,
    field: 'publish',
    label: '发布设置',
    span: 12,
    slots: {
      default: () => h('span', '允许发布'),
    },
  }),
  defineField({
    component: AInput,
    field: 'publishNote',
    label: '发布备注',
    props: {
      placeholder: '请输入 Antd 发布备注',
    },
    span: 24,
    visible: values => values.publish,
  }),
  defineField({
    component: ATag,
    props: {
      color: 'blue',
    },
    slots: {
      default: () => h('span', '容器节点不会生成字段壳，也不绑定表单值'),
    },
    span: 24,
  }),
]

const submittedText = computed(() => JSON.stringify(submittedValues.value, null, 2))

function handleSubmit(values: ConfigFormValues): void {
  submittedValues.value = values as AntdFormValues
}
</script>

<template>
  <div class="config-form-demo" data-testid="antd-config-form-example">
    <antdConfigForm
      v-model="formModel"
      :fields="fields"
      @submit="handleSubmit"
    >
      <template #default="{ submit, resetFields }">
        <div class="config-form-demo__actions">
          <AButton type="primary" data-testid="antd-config-submit" @click="submit">
            提交
          </AButton>
          <AButton data-testid="antd-config-reset" @click="resetFields">
            重置
          </AButton>
        </div>
      </template>
    </antdConfigForm>

    <ADivider />

    <pre class="config-form-demo__preview" data-testid="antd-config-preview">{{ submittedText }}</pre>
  </div>
</template>

<style scoped lang="scss">
.config-form-demo {
  max-width: 760px;
}

.config-form-demo__actions {
  display: flex;
  gap: 10px;
}

.config-form-demo__preview {
  min-height: 120px;
  margin: 0;
  padding: 14px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fafafa;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
