<script setup lang="ts">
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { reactive, ref } from 'vue'
import { z } from 'zod'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { createAntdVuePlugin } from '@moluoxixi/config-form-plugin-antd-vue'
import Input from 'ant-design-vue/es/input'
import InputNumber from 'ant-design-vue/es/input-number'
import Select from 'ant-design-vue/es/select'
import Switch from 'ant-design-vue/es/switch'
import Card from 'ant-design-vue/es/card'

const formRef = ref()
const formValues = reactive<Record<string, unknown>>({})

const runtimeOptions = {
  plugins: [createAntdVuePlugin()],
} satisfies FormRuntimeOptions

const fields = [
  defineField({
    field: 'title',
    label: '项目名称',
    span: 12,
    component: Input,
    props: { placeholder: '请输入项目名称' },
    schema: z.string().min(1, '项目名称必填'),
  }),
  defineField({
    field: 'status',
    label: '状态',
    span: 12,
    component: Select,
    props: {
      placeholder: '请选择状态',
      options: [
        { label: '进行中', value: 'active' },
        { label: '已暂停', value: 'paused' },
        { label: '已完成', value: 'done' },
      ],
    },
  }),

  // Card 内切换为 inline 布局
  defineField({
    component: Card,
    props: { title: '负责人信息' },
    span: 24,
    slots: {
      default: [
        defineField({
          component: 'FormLayout',
          props: { inline: true },
          slots: {
            default: [
              defineField({ field: 'owner', label: '负责人', component: Input, props: { placeholder: '负责人姓名' } }),
              defineField({ field: 'ownerPhone', label: '电话', component: Input, props: { placeholder: '联系电话' } }),
              defineField({ field: 'ownerEmail', label: '邮箱', component: Input, props: { placeholder: '联系邮箱' } }),
            ],
          },
        }),
      ],
    },
  }),

  // Card 内独立 3 列 grid
  defineField({
    component: Card,
    props: { title: '预算明细' },
    span: 24,
    slots: {
      default: [
        defineField({
          component: 'FormLayout',
          props: { inline: false, columns: 3, gap: '16px 8px' },
          slots: {
            default: [
              defineField({ field: 'budgetQ1', label: 'Q1 预算', span: 1, component: InputNumber, props: { min: 0, placeholder: 'Q1', style: { width: '100%' } } }),
              defineField({ field: 'budgetQ2', label: 'Q2 预算', span: 1, component: InputNumber, props: { min: 0, placeholder: 'Q2', style: { width: '100%' } } }),
              defineField({ field: 'budgetQ3', label: 'Q3 预算', span: 1, component: InputNumber, props: { min: 0, placeholder: 'Q3', style: { width: '100%' } } }),
              defineField({ field: 'budgetQ4', label: 'Q4 预算', span: 1, component: InputNumber, props: { min: 0, placeholder: 'Q4', style: { width: '100%' } } }),
              defineField({ field: 'totalBudget', label: '总预算', span: 1, component: InputNumber, props: { min: 0, placeholder: '总计', style: { width: '100%' } } }),
              defineField({ field: 'budgetApproved', label: '已审批', span: 1, component: Switch }),
            ],
          },
        }),
      ],
    },
  }),

  // inline 里再嵌 grid
  defineField({
    component: Card,
    props: { title: '地址信息' },
    span: 24,
    slots: {
      default: [
        defineField({
          component: 'FormLayout',
          props: { inline: true },
          slots: {
            default: [
              defineField({ field: 'province', label: '省', component: Input, props: { placeholder: '省份' } }),
              defineField({ field: 'city', label: '市', component: Input, props: { placeholder: '城市' } }),
              defineField({
                component: 'FormLayout',
                props: { inline: false, columns: 2, gap: '8px' },
                slots: {
                  default: [
                    defineField({ field: 'district', label: '区', span: 1, component: Input, props: { placeholder: '区县' } }),
                    defineField({ field: 'street', label: '街道', span: 1, component: Input, props: { placeholder: '街道地址' } }),
                  ],
                },
              }),
            ],
          },
        }),
      ],
    },
  }),

  defineField({
    field: 'description',
    label: '项目描述',
    span: 24,
    component: Input.TextArea,
    props: { placeholder: '请输入项目描述', rows: 3 },
  }),
]

/**
 * 展示嵌套布局表单提交结果，并刷新提交值快照。
 *
 * 示例只在本地弹窗展示提交内容，不发起远端请求。
 */
function onSubmit(values: Record<string, unknown>) {
  Object.assign(formValues, values)
  alert(`提交成功！\n${JSON.stringify(values, null, 2)}`)
}
</script>

<template>
  <div>
    <ConfigForm
      ref="formRef"
      :default-values="formValues"
      namespace="moluoxixi"
      :fields="fields"
      :runtime="runtimeOptions"
      label-width="80px"
      @submit="onSubmit"
    />

    <div class="demo-actions">
      <a-button type="primary" @click="formRef?.submit()">提交</a-button>
      <a-button @click="formRef?.reset()">重置</a-button>
    </div>

    <a-divider>提交值快照</a-divider>
    <pre class="value-preview">{{ JSON.stringify(formValues, null, 2) }}</pre>
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
