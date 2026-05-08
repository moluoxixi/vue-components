<script setup lang="ts">
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { ElCard, ElInput, ElInputNumber, ElSelect, ElSwitch } from 'element-plus'
import { reactive, ref } from 'vue'
import { z } from 'zod'

const formRef = ref()
const formValues = reactive<Record<string, unknown>>({})

const fields = [
  defineField({
    field: 'title',
    label: '项目名称',
    span: 12,
    component: ElInput,
    props: { placeholder: '请输入项目名称' },
    schema: z.string().min(1, '项目名称必填'),
  }),
  defineField({
    field: 'status',
    label: '状态',
    span: 12,
    component: ElSelect,
    props: {
      placeholder: '请选择状态',
      clearable: true,
      options: [
        { label: '进行中', value: 'active' },
        { label: '已暂停', value: 'paused' },
        { label: '已完成', value: 'done' },
      ],
    },
  }),

  // Card 内切换为 inline 布局
  defineField({
    component: ElCard,
    props: { header: '负责人信息' },
    span: 24,
    slots: {
      default: [
        defineField({
          component: 'FormLayout',
          props: { inline: true },
          slots: {
            default: [
              defineField({ field: 'owner', label: '负责人', component: ElInput, props: { placeholder: '负责人姓名' } }),
              defineField({ field: 'ownerPhone', label: '电话', component: ElInput, props: { placeholder: '联系电话' } }),
              defineField({ field: 'ownerEmail', label: '邮箱', component: ElInput, props: { placeholder: '联系邮箱' } }),
            ],
          },
        }),
      ],
    },
  }),

  // Card 内独立 3 列 grid
  defineField({
    component: ElCard,
    props: { header: '预算明细' },
    span: 24,
    slots: {
      default: [
        defineField({
          component: 'FormLayout',
          props: { inline: false, columns: 3, gap: '16px 8px' },
          slots: {
            default: [
              defineField({ field: 'budgetQ1', label: 'Q1 预算', span: 1, component: ElInputNumber, props: { min: 0, placeholder: 'Q1', controlsPosition: 'right' } }),
              defineField({ field: 'budgetQ2', label: 'Q2 预算', span: 1, component: ElInputNumber, props: { min: 0, placeholder: 'Q2', controlsPosition: 'right' } }),
              defineField({ field: 'budgetQ3', label: 'Q3 预算', span: 1, component: ElInputNumber, props: { min: 0, placeholder: 'Q3', controlsPosition: 'right' } }),
              defineField({ field: 'budgetQ4', label: 'Q4 预算', span: 1, component: ElInputNumber, props: { min: 0, placeholder: 'Q4', controlsPosition: 'right' } }),
              defineField({ field: 'totalBudget', label: '总预算', span: 1, component: ElInputNumber, props: { min: 0, placeholder: '总计', controlsPosition: 'right' } }),
              defineField({ field: 'budgetApproved', label: '已审批', span: 1, component: ElSwitch }),
            ],
          },
        }),
      ],
    },
  }),

  // inline 里再嵌 grid
  defineField({
    component: ElCard,
    props: { header: '地址信息' },
    span: 24,
    slots: {
      default: [
        defineField({
          component: 'FormLayout',
          props: { inline: true },
          slots: {
            default: [
              defineField({ field: 'province', label: '省', component: ElInput, props: { placeholder: '省份' } }),
              defineField({ field: 'city', label: '市', component: ElInput, props: { placeholder: '城市' } }),
              defineField({
                component: 'FormLayout',
                props: { inline: false, columns: 2, gap: '8px' },
                slots: {
                  default: [
                    defineField({ field: 'district', label: '区', span: 1, component: ElInput, props: { placeholder: '区县' } }),
                    defineField({ field: 'street', label: '街道', span: 1, component: ElInput, props: { placeholder: '街道地址' } }),
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
    component: ElInput,
    props: { type: 'textarea', placeholder: '请输入项目描述', rows: 3 },
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
      label-width="80px"
      @submit="onSubmit"
    />

    <div class="demo-actions">
      <el-button type="primary" @click="formRef?.submit()">提交</el-button>
      <el-button @click="formRef?.reset()">重置</el-button>
    </div>

    <el-divider>提交值快照</el-divider>
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
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.6;
  max-height: 300px;
  overflow: auto;
}
</style>
