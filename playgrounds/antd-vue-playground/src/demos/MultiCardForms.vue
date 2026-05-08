<script setup lang="ts">
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { reactive, ref } from 'vue'
import { z } from 'zod'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { createAntdVuePlugin } from '@moluoxixi/config-form-plugin-antd-vue'
import Card from 'ant-design-vue/es/card'
import DatePicker from 'ant-design-vue/es/date-picker'
import Input from 'ant-design-vue/es/input'
import InputNumber from 'ant-design-vue/es/input-number'
import Select from 'ant-design-vue/es/select'
import Switch from 'ant-design-vue/es/switch'

const showAuditForm = ref(true)
const formValues = reactive<Record<string, Record<string, unknown>>>({
  account: {},
  billing: {},
  delivery: {},
  audit: {},
  risk: {},
})

const runtimeOptions = {
  plugins: [createAntdVuePlugin()],
} satisfies FormRuntimeOptions

const statusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '停用', value: 'disabled' },
]

const priorityOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
]

interface DayjsLike {
  format: (template: string) => string
}

/**
 * 判断值是否是 Ant Design Vue 日期组件返回的 Dayjs 类对象。
 *
 * 仅依赖 format 函数存在性，避免 playground 引入具体 Dayjs 类型。
 */
function isDayjsLike(value: unknown): value is DayjsLike {
  return Boolean(value && typeof value === 'object' && typeof (value as Partial<DayjsLike>).format === 'function')
}

/**
 * 将续费日期转换为 YYYY-MM-DD 提交值。
 *
 * 非 Dayjs 类对象保持原样，方便清空值和外部写入值通过。
 */
function formatDateValue(value: unknown): unknown {
  return isDayjsLike(value) ? value.format('YYYY-MM-DD') : value
}

const sections = [
  {
    key: 'account',
    namespace: 'multi-account',
    title: '账户信息 Form',
    fields: [
      defineField({
        field: 'accountName',
        label: '账户名',
        schema: z.string().min(2, '账户名至少 2 个字符'),
        span: 12,
        component: Input,
        props: { allowClear: true, placeholder: '请输入账户名' },
      }),
      defineField({
        field: 'owner',
        label: '负责人',
        span: 12,
        component: Input,
        props: { allowClear: true, placeholder: '请输入负责人' },
      }),
      defineField({
        field: 'status',
        label: '状态',
        span: 12,
        component: Select,
        props: { allowClear: true, options: statusOptions, placeholder: '请选择状态' },
      }),
      defineField({
        field: 'enabled',
        label: '启用',
        span: 12,
        component: Switch,
        defaultValue: true,
      }),
    ],
  },
  {
    key: 'billing',
    namespace: 'multi-billing',
    title: '计费配置 Form',
    fields: [
      defineField({
        field: 'planName',
        label: '套餐名',
        schema: z.string().min(1, '请输入套餐名'),
        span: 12,
        component: Input,
        props: { allowClear: true, placeholder: '请输入套餐名' },
      }),
      defineField({
        field: 'quota',
        label: '额度',
        schema: z.number().min(0).optional(),
        span: 12,
        component: InputNumber,
        props: { min: 0, placeholder: '额度' },
      }),
      defineField({
        field: 'renewalDate',
        label: '续费日期',
        span: 12,
        component: DatePicker,
        props: { allowClear: true, placeholder: '选择日期' },
        transform: formatDateValue,
      }),
      defineField({
        field: 'priority',
        label: '优先级',
        span: 12,
        component: Select,
        props: { allowClear: true, options: priorityOptions, placeholder: '请选择优先级' },
      }),
    ],
  },
  {
    key: 'delivery',
    namespace: 'multi-delivery',
    title: '交付设置 Form',
    fields: [
      defineField({
        field: 'region',
        label: '区域',
        span: 12,
        component: Select,
        props: {
          allowClear: true,
          options: [
            { label: '华东', value: 'east' },
            { label: '华南', value: 'south' },
            { label: '华北', value: 'north' },
          ],
          placeholder: '请选择区域',
        },
      }),
      defineField({
        field: 'endpoint',
        label: 'Endpoint',
        span: 12,
        component: Input,
        props: { allowClear: true, placeholder: 'https://example.com' },
      }),
      defineField({
        field: 'retryCount',
        label: '重试次数',
        span: 12,
        component: InputNumber,
        props: { max: 10, min: 0, placeholder: '次数' },
      }),
      defineField({
        field: 'remark',
        label: '备注',
        span: 12,
        component: Input,
        props: { allowClear: true, placeholder: '请输入备注' },
      }),
    ],
  },
  {
    key: 'audit',
    namespace: 'multi-audit',
    title: '审计策略 Form',
    fields: [
      defineField({
        field: 'ruleName',
        label: '规则名',
        schema: z.string().min(1, '请输入规则名'),
        span: 12,
        component: Input,
        props: { allowClear: true, placeholder: '请输入规则名' },
      }),
      defineField({
        field: 'retentionDays',
        label: '保留天数',
        schema: z.number().min(1).optional(),
        span: 12,
        component: InputNumber,
        props: { min: 1, placeholder: '天数' },
      }),
      defineField({
        field: 'notifyOwner',
        label: '通知负责人',
        span: 12,
        component: Switch,
        defaultValue: true,
      }),
      defineField({
        field: 'level',
        label: '级别',
        span: 12,
        component: Select,
        props: { allowClear: true, options: priorityOptions, placeholder: '请选择级别' },
      }),
    ],
  },
  {
    key: 'risk',
    namespace: 'multi-risk',
    title: '风险控制 Form',
    fields: [
      defineField({
        field: 'threshold',
        label: '阈值',
        schema: z.number().min(0).max(100).optional(),
        span: 12,
        component: InputNumber,
        props: { max: 100, min: 0, placeholder: '0-100' },
      }),
      defineField({
        field: 'strategy',
        label: '策略',
        span: 12,
        component: Select,
        props: {
          allowClear: true,
          options: [
            { label: '观察', value: 'observe' },
            { label: '拦截', value: 'block' },
            { label: '人工复核', value: 'review' },
          ],
          placeholder: '请选择策略',
        },
      }),
      defineField({
        field: 'reviewer',
        label: '复核人',
        span: 12,
        component: Input,
        props: { allowClear: true, placeholder: '请输入复核人' },
      }),
      defineField({
        field: 'active',
        label: '生效',
        span: 12,
        component: Switch,
        defaultValue: true,
      }),
    ],
  },
]

/**
 * 判断多表单示例中的分组是否可见。
 *
 * 当前只允许审计表单被开关控制，其余分组始终展示以保持多表单导航稳定。
 */
function isSectionVisible(key: string): boolean {
  return key !== 'audit' || showAuditForm.value
}

</script>

<template>
  <div class="multi-card-forms">
    <div class="multi-card-toolbar">
      <Switch
        v-model:checked="showAuditForm"
        checked-children="显示审计 Form"
        un-checked-children="隐藏审计 Form"
      />
    </div>

    <Card
      v-for="section in sections"
      :key="section.key"
      v-show="isSectionVisible(section.key)"
      class="multi-card-form"
      size="small"
      :title="section.title"
      :data-cf-devtools-form-label="section.title"
    >
      <ConfigForm
        :default-values="formValues[section.key]"
        :namespace="section.namespace"
        :fields="section.fields"
        :runtime="runtimeOptions"
        label-width="96px"
      />

      <pre class="multi-card-form__value">{{ JSON.stringify(formValues[section.key], null, 2) }}</pre>
    </Card>
  </div>
</template>

<style lang="scss">
.multi-card-forms {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.multi-card-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 12px 0;
  background: #fff;
}

.multi-card-form {
  min-height: 360px;
}

.multi-card-form__value {
  margin: 16px 0 0;
  max-height: 140px;
  overflow: auto;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fafafa;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.6;
}
</style>
