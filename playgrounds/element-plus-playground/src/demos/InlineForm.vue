<script setup lang="ts">
import { reactive, ref } from 'vue'
import { z } from 'zod'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import {
  ElAutocomplete,
  ElCascader,
  ElCheckbox,
  ElCheckboxGroup,
  ElColorPicker,
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElRadio,
  ElRadioGroup,
  ElRate,
  ElSelectV2,
  ElSlider,
  ElSwitch,
  ElTimePicker,
  ElTimeSelect,
  ElTreeSelect,
} from 'element-plus'

const formRef = ref()
const formValues = reactive<Record<string, unknown>>({})

const fields = [
  defineField({
    field: 'keyword',
    label: '关键词',
    schema: z.string().min(1, '请输入关键词'),
    component: ElInput,
    props: { placeholder: '搜索...', clearable: true },
  }),
  defineField({
    field: 'password',
    label: '密码',
    component: ElInput,
    props: { type: 'password', placeholder: '密码', showPassword: true },
  }),
  defineField({
    field: 'status',
    label: '状态',
    component: ElSelectV2,
    props: {
      placeholder: '状态筛选',
      clearable: true,
      options: [
        { label: '启用', value: 'active' },
        { label: '禁用', value: 'inactive' },
      ],
    },
  }),
  defineField({
    field: 'role',
    label: '角色',
    component: ElSelectV2,
    props: {
      placeholder: '角色筛选',
      clearable: true,
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
    component: ElSelectV2,
    props: {
      multiple: true,
      placeholder: '多选标签',
      clearable: true,
      options: [
        { label: 'Vue', value: 'vue' },
        { label: 'React', value: 'react' },
        { label: 'Angular', value: 'angular' },
      ],
    },
    defaultValue: [],
  }),
  defineField({
    field: 'city',
    label: '城市',
    component: ElSelectV2,
    props: {
      filterable: true,
      placeholder: '搜索城市',
      clearable: true,
      options: [
        { label: '北京', value: 'beijing' },
        { label: '上海', value: 'shanghai' },
        { label: '广州', value: 'guangzhou' },
        { label: '深圳', value: 'shenzhen' },
      ],
    },
  }),
  defineField({
    field: 'age',
    label: '年龄',
    component: ElInputNumber,
    props: { min: 1, max: 150, placeholder: '年龄', controlsPosition: 'right' },
  }),
  defineField({
    field: 'department',
    label: '部门',
    component: ElCascader,
    props: {
      placeholder: '部门',
      clearable: true,
      options: [
        { value: 'tech', label: '技术部', children: [{ value: 'frontend', label: '前端组' }, { value: 'backend', label: '后端组' }] },
        { value: 'product', label: '产品部', children: [{ value: 'design', label: '设计组' }, { value: 'pm', label: '产品组' }] },
      ],
    },
  }),
  defineField({
    field: 'manager',
    label: '上级',
    component: ElTreeSelect,
    props: {
      placeholder: '上级',
      clearable: true,
      checkStrictly: true,
      data: [
        { value: 'ceo', label: 'CEO', children: [{ value: 'cto', label: 'CTO' }, { value: 'cpo', label: 'CPO' }] },
      ],
    },
  }),
  defineField({
    field: 'gender',
    label: '性别',
    component: ElRadioGroup,
    slots: {
      default: [
        defineField({
          component: ElRadio,
          props: { value: 'male' },
          slots: { default: defineField({ component: 'span', props: { textContent: '男' } }) },
        }),
        defineField({
          component: ElRadio,
          props: { value: 'female' },
          slots: { default: defineField({ component: 'span', props: { textContent: '女' } }) },
        }),
        defineField({
          component: ElRadio,
          props: { value: 'other' },
          slots: { default: defineField({ component: 'span', props: { textContent: '其他' } }) },
        }),
      ],
    },
  }),
  defineField({
    field: 'hobbies',
    label: '爱好',
    component: ElCheckboxGroup,
    defaultValue: [],
    slots: {
      default: [
        defineField({
          component: ElCheckbox,
          props: { value: 'reading', label: '阅读' },
        }),
        defineField({
          component: ElCheckbox,
          props: { value: 'sports', label: '运动' },
        }),
        defineField({
          component: ElCheckbox,
          props: { value: 'music', label: '音乐' },
        }),
      ],
    },
  }),
  defineField({
    field: 'date',
    label: '日期',
    component: ElDatePicker,
    props: { type: 'date', placeholder: '选择日期', valueFormat: 'YYYY-MM-DD', clearable: true },
  }),
  defineField({
    field: 'dateRange',
    label: '有效期',
    component: ElDatePicker,
    props: { type: 'daterange', startPlaceholder: '开始', endPlaceholder: '结束', valueFormat: 'YYYY-MM-DD', clearable: true },
    defaultValue: [],
  }),
  defineField({
    field: 'time',
    label: '时间',
    component: ElTimeSelect,
    props: { placeholder: '选择时间', start: '06:00', step: '00:30', end: '22:00', clearable: true },
  }),
  defineField({
    field: 'timePicker',
    label: '时刻',
    component: ElTimePicker,
    props: { placeholder: '选择时刻', valueFormat: 'HH:mm:ss', clearable: true },
  }),
  defineField({
    field: 'priority',
    label: '优先级',
    component: ElRate,
    props: { allowHalf: true },
    defaultValue: 0,
  }),
  defineField({
    field: 'active',
    label: '启用',
    component: ElSwitch,
    defaultValue: true,
  }),
  defineField({
    field: 'progress',
    label: '进度',
    component: ElSlider,
    defaultValue: 0,
  }),
  defineField({
    field: 'color',
    label: '颜色',
    component: ElColorPicker,
    defaultValue: '#409EFF',
  }),
  defineField({
    field: 'cityName',
    label: '城市名',
    component: ElAutocomplete,
    props: {
      placeholder: '输入城市名',
      clearable: true,
      /**
       * 为 Element Plus 自动补全提供城市候选项。
       *
       * 只在本地示例数据中筛选，结果通过组件要求的回调返回。
       */
      fetchSuggestions: (qs: string, cb: (items: Array<{ value: string }>) => void) => {
        const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都']
        const results = qs ? cities.filter(c => c.includes(qs)).map(c => ({ value: c })) : cities.map(c => ({ value: c }))
        cb(results)
      },
    },
  }),
  // 条件显隐
  defineField({
    field: 'genderOther',
    label: '说明',
    component: ElInput,
    props: { placeholder: '请说明', clearable: true },
    /** 仅在性别选择“其他”时展示补充说明字段。 */
    visible: (values) => values.gender === 'other',
  }),
  // 条件禁用
  defineField({
    field: 'remark',
    label: '备注',
    component: ElInput,
    props: { placeholder: '访客不可编辑', clearable: true },
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
      @submit="onSubmit"
      @error="onError"
      @update:model-value="(vals: Record<string, unknown>) => Object.assign(formValues, vals)"
    />
    <div class="demo-actions">
      <el-button type="primary" @click="formRef?.submit()">
        搜索
      </el-button>
      <el-button @click="formRef?.reset()">
        重置
      </el-button>
    </div>
    <el-divider>实时值（v-model）</el-divider>
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
