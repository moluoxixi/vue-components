<script lang="ts">
// 示例元信息由 playground 通过 import.meta.glob 读取，用于生成侧栏和页面标题。
export const exampleMeta = {
  name: 'ElementConfigForm',
  title: 'ElementConfigForm',
  category: '配置表单',
  description: 'Element Plus 轻量配置表单包的字段写回、条件字段和提交场景。',
  order: 40,
}
</script>

<script setup lang="ts">
import type { ConfigFormValues } from '@moluoxixi/config-form-core'
import { defineField } from '@moluoxixi/config-form-core'
import { ElementConfigForm } from '@moluoxixi/config-form-element'
import { ElCheckbox, ElInput, ElTag } from 'element-plus'
import { computed, h, shallowRef } from 'vue'

interface ElementFormValues {
  accountName: string
  advanced: boolean
  advancedNote: string
}

const formModel = shallowRef<ElementFormValues>({
  accountName: '',
  advanced: false,
  advancedNote: '',
})
const submittedValues = shallowRef<Partial<ElementFormValues>>({})

const fields = [
  defineField<ElementFormValues>({
    component: ElInput,
    field: 'accountName',
    label: '账户名称',
    props: {
      placeholder: '请输入 Element 账户名称',
    },
    rules: [{ message: '请输入账户名称', required: true, trigger: 'blur' }],
    span: 12,
  }),
  defineField<ElementFormValues>({
    component: ElCheckbox,
    field: 'advanced',
    label: '高级模式',
    props: {
      label: '启用高级字段',
    },
    span: 12,
  }),
  defineField<ElementFormValues>({
    component: ElInput,
    field: 'advancedNote',
    label: '高级备注',
    props: {
      placeholder: '请输入 Element 高级备注',
    },
    span: 24,
    visible: values => values.advanced,
  }),
  defineField<ElementFormValues>({
    component: ElTag,
    props: {
      type: 'info',
    },
    slots: {
      default: () => h('span', '容器节点不会生成 FormItem'),
    },
    span: 24,
  }),
]

const submittedText = computed(() => JSON.stringify(submittedValues.value, null, 2))

function handleSubmit(values: ConfigFormValues): void {
  submittedValues.value = values as ElementFormValues
}
</script>

<template>
  <div class="config-form-demo" data-testid="element-config-form-example">
    <ElementConfigForm
      v-model="formModel"
      :fields="fields"
      :form-props="{ labelWidth: '96px' }"
      @submit="handleSubmit"
    >
      <template #default="{ submit, resetFields }">
        <div class="config-form-demo__actions">
          <ElButton type="primary" data-testid="element-config-submit" @click="submit">
            提交
          </ElButton>
          <ElButton data-testid="element-config-reset" @click="resetFields">
            重置
          </ElButton>
        </div>
      </template>
    </ElementConfigForm>

    <ElDivider />

    <pre class="config-form-demo__preview" data-testid="element-config-preview">{{ submittedText }}</pre>
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
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
