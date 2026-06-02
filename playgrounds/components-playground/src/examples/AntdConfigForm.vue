<script lang="ts">
// 示例元信息由 playground 通过 import.meta.glob 读取，用于生成侧栏和页面标题。
export const exampleMeta = {
  name: 'antdConfigForm',
  title: 'antdConfigForm',
  category: '配置表单',
  description: 'components 包内置 Ant Design Vue 配置表单的字段写回、checked 绑定和提交场景。',
  order: 50,
}
</script>

<script setup lang="ts">
import type { ConfigFormValues } from '@moluoxixi/components'
import { antdConfigForm, defineField } from '@moluoxixi/components'
import { Button as AButton, Checkbox as ACheckbox, Input as AInput, Tag as ATag } from 'ant-design-vue'
import { computed, h, shallowRef } from 'vue'

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

const fields = [
  defineField<AntdFormValues>({
    component: AInput,
    field: 'projectName',
    label: '项目名称',
    props: {
      placeholder: '请输入 Antd 项目名称',
    },
    rules: [{ message: '请输入项目名称', required: true }],
    span: 12,
  }),
  defineField<AntdFormValues>({
    component: ACheckbox,
    field: 'publish',
    label: '发布设置',
    span: 12,
    slots: {
      default: () => h('span', '允许发布'),
    },
    trigger: 'update:checked',
    valueProp: 'checked',
  }),
  defineField<AntdFormValues>({
    component: AInput,
    field: 'publishNote',
    label: '发布备注',
    props: {
      placeholder: '请输入 Antd 发布备注',
    },
    span: 24,
    visible: values => values.publish,
  }),
  defineField<AntdFormValues>({
    component: ATag,
    props: {
      color: 'blue',
    },
    slots: {
      default: () => h('span', '容器节点不会生成 FormItem'),
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
      :form-props="{ labelCol: { style: { width: '96px' } }, wrapperCol: { flex: 1 } }"
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

    <ElDivider />

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
  margin-left: 96px;
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
