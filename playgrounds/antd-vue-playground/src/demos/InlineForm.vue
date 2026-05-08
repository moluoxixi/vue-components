<script setup lang="ts">
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { reactive, ref } from 'vue'
import { z } from 'zod'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { createAntdVuePlugin } from '@moluoxixi/config-form-plugin-antd-vue'
import AutoComplete from 'ant-design-vue/es/auto-complete'
import Cascader from 'ant-design-vue/es/cascader'
import Checkbox, { CheckboxGroup } from 'ant-design-vue/es/checkbox'
import DatePicker from 'ant-design-vue/es/date-picker'
import Input from 'ant-design-vue/es/input'
import InputNumber from 'ant-design-vue/es/input-number'
import Radio, { RadioGroup } from 'ant-design-vue/es/radio'
import Rate from 'ant-design-vue/es/rate'
import Select from 'ant-design-vue/es/select'
import Slider from 'ant-design-vue/es/slider'
import Switch from 'ant-design-vue/es/switch'
import TimePicker from 'ant-design-vue/es/time-picker'
import TreeSelect from 'ant-design-vue/es/tree-select'

const formRef = ref()
const formValues = reactive<Record<string, unknown>>({})

const runtimeOptions = {
  plugins: [createAntdVuePlugin()],
} satisfies FormRuntimeOptions

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
 * 将单个日期值格式化为提交值。
 *
 * 非 Dayjs 类对象保持原值，用于兼容清空或外部手动写入的值。
 */
function formatDateValue(value: unknown, template: string): unknown {
  return isDayjsLike(value) ? value.format(template) : value
}

/**
 * 格式化日期范围提交值。
 *
 * 仅数组会逐项格式化，其他值保持原样交给上层 schema 或展示逻辑处理。
 */
function formatDateRange(value: unknown, template: string): unknown {
  return Array.isArray(value) ? value.map(item => formatDateValue(item, template)) : value
}

/**
 * 过滤 AutoComplete 选项。
 *
 * 只匹配字符串 value，未知选项结构不会参与候选展示。
 */
function optionIncludes(input: string, option: unknown): boolean {
  const value = option && typeof option === 'object' ? (option as { value?: unknown }).value : undefined
  return typeof value === 'string' && value.includes(input)
}

const fields = [
  defineField({
    field: 'keyword',
    label: '关键词',
    schema: z.string().min(1, '请输入关键词'),
    component: Input,
    props: { placeholder: '搜索...', allowClear: true },
  }),
  defineField({
    field: 'password',
    label: '密码',
    component: Input.Password,
    props: { placeholder: '密码' },
  }),
  defineField({
    field: 'status',
    label: '状态',
    component: Select,
    props: {
      placeholder: '状态筛选',
      allowClear: true,
      options: [
        { label: '启用', value: 'active' },
        { label: '禁用', value: 'inactive' },
      ],
    },
  }),
  defineField({
    field: 'role',
    label: '角色',
    component: Select,
    props: {
      placeholder: '角色筛选',
      allowClear: true,
      options: [
        { label: '管理员', value: 'admin' },
        { label: '用户', value: 'user' },
        { label: '访客', value: 'guest' },
      ],
    },
  }),
  defineField({
    field: 'tags',
    label: '标签',
    component: Select,
    props: {
      mode: 'multiple',
      placeholder: '多选标签',
      allowClear: true,
      options: [
        { label: 'Vue', value: 'vue' },
        { label: 'React', value: 'react' },
        { label: 'Angular', value: 'angular' },
      ],
    },
    defaultValue: [],
  }),
  defineField({
    field: 'age',
    label: '年龄',
    component: InputNumber,
    props: { min: 1, max: 150, placeholder: '年龄' },
  }),
  defineField({
    field: 'department',
    label: '部门',
    component: Cascader,
    props: {
      placeholder: '部门',
      allowClear: true,
      options: [
        { value: 'tech', label: '技术部', children: [{ value: 'frontend', label: '前端组' }, { value: 'backend', label: '后端组' }] },
        { value: 'product', label: '产品部', children: [{ value: 'design', label: '设计组' }, { value: 'pm', label: '产品组' }] },
      ],
    },
  }),
  defineField({
    field: 'manager',
    label: '上级',
    component: TreeSelect,
    props: {
      placeholder: '上级',
      allowClear: true,
      treeData: [
        { value: 'ceo', title: 'CEO', children: [{ value: 'cto', title: 'CTO' }, { value: 'cpo', title: 'CPO' }] },
      ],
    },
  }),
  defineField({
    field: 'gender',
    label: '性别',
    component: RadioGroup,
    slots: {
      default: [
        defineField({
          component: Radio,
          props: { value: 'male' },
          slots: { default: defineField({ component: 'span', props: { textContent: '男' } }) },
        }),
        defineField({
          component: Radio,
          props: { value: 'female' },
          slots: { default: defineField({ component: 'span', props: { textContent: '女' } }) },
        }),
        defineField({
          component: Radio,
          props: { value: 'other' },
          slots: { default: defineField({ component: 'span', props: { textContent: '其他' } }) },
        }),
      ],
    },
  }),
  defineField({
    field: 'hobbies',
    label: '爱好',
    component: CheckboxGroup,
    defaultValue: [],
    slots: {
      default: [
        defineField({
          component: Checkbox,
          props: { value: 'reading' },
          slots: { default: defineField({ component: 'span', props: { textContent: '阅读' } }) },
        }),
        defineField({
          component: Checkbox,
          props: { value: 'sports' },
          slots: { default: defineField({ component: 'span', props: { textContent: '运动' } }) },
        }),
        defineField({
          component: Checkbox,
          props: { value: 'music' },
          slots: { default: defineField({ component: 'span', props: { textContent: '音乐' } }) },
        }),
      ],
    },
  }),
  defineField({
    field: 'date',
    label: '日期',
    component: DatePicker,
    props: { placeholder: '选择日期', allowClear: true },
    /** 将 DatePicker 的 Dayjs 值转换为 YYYY-MM-DD 提交值。 */
    transform: val => formatDateValue(val, 'YYYY-MM-DD'),
  }),
  defineField({
    field: 'dateRange',
    label: '有效期',
    component: DatePicker.RangePicker,
    props: { placeholder: ['开始', '结束'], allowClear: true },
    /** 将 RangePicker 的 Dayjs 数组转换为日期字符串数组。 */
    transform: val => formatDateRange(val, 'YYYY-MM-DD'),
  }),
  defineField({
    field: 'time',
    label: '时间',
    component: TimePicker,
    props: { placeholder: '选择时间', allowClear: true, format: 'HH:mm' },
    /** 将 TimePicker 的 Dayjs 值转换为 HH:mm 提交值。 */
    transform: val => formatDateValue(val, 'HH:mm'),
  }),
  defineField({
    field: 'priority',
    label: '优先级',
    component: Rate,
    props: { allowHalf: true },
    defaultValue: 0,
  }),
  defineField({
    field: 'active',
    label: '启用',
    component: Switch,
    defaultValue: true,
  }),
  defineField({
    field: 'progress',
    label: '进度',
    component: Slider,
    defaultValue: 0,
  }),
  defineField({
    field: 'city',
    label: '城市',
    component: AutoComplete,
    props: {
      placeholder: '城市',
      allowClear: true,
      options: ['北京', '上海', '广州', '深圳', '杭州', '成都'].map(c => ({ value: c })),
      filterOption: optionIncludes,
    },
  }),
  // 条件显隐
  defineField({
    field: 'genderOther',
    label: '说明',
    component: Input,
    props: { placeholder: '请说明', allowClear: true },
    /** 仅在性别选择“其他”时展示补充说明字段。 */
    visible: (values) => values.gender === 'other',
  }),
  // 条件禁用
  defineField({
    field: 'remark',
    label: '备注',
    component: Input,
    props: { placeholder: '访客不可编辑', allowClear: true },
    /** 访客角色不可编辑备注。 */
    disabled: (values) => values.role === 'guest',
  }),
]

/**
 * 展示内联表单提交结果。
 *
 * playground 通过 alert 直接反馈提交值，不向远端接口发送数据。
 */
function onSubmit(values: Record<string, unknown>) {
  alert(`搜索提交！\n${JSON.stringify(values, null, 2)}`)
}

/**
 * 输出内联表单校验失败结果。
 *
 * 示例只写入控制台，实际业务可在这里接入消息提示或埋点。
 */
function onError(errors: Record<string, string[]>) {
  console.error('校验失败：', errors)
}
</script>

<template>
  <div>
    <ConfigForm
      ref="formRef"
      :model-value="formValues"
      namespace="moluoxixi"
      :fields="fields"
      :inline="true"
      :runtime="runtimeOptions"
      @submit="onSubmit"
      @error="onError"
      @update:model-value="(vals: Record<string, unknown>) => Object.assign(formValues, vals)"
    />
    <div class="demo-actions">
      <a-button type="primary" @click="formRef?.submit()">
        搜索
      </a-button>
      <a-button @click="formRef?.reset()">
        重置
      </a-button>
    </div>
    <a-divider>实时值（v-model）</a-divider>
    <pre class="value-preview">{{ JSON.stringify(formValues, null, 2) }}</pre>
  </div>
</template>

<style lang="scss">
.demo-actions {
  margin-top: 12px;
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
