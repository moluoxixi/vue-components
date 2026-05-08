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
import Input, { Textarea } from 'ant-design-vue/es/input'
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
  // 文本输入
  defineField({
    field: 'username',
    label: '用户名',
    validateOn: ['blur', 'change'],
    schema: z.string().min(2, '用户名至少 2 个字符').max(20, '用户名最多 20 个字符'),
    span: 12,
    component: Input,
    props: { placeholder: '请输入用户名', allowClear: true },
    /**
     * 校验用户名与角色组合。
     *
     * 访客账号需要更长用户名；空格作为示例业务禁用字符处理。
     */
    validator: (value, values) => {
      if (values.role === 'guest' && value.length < 4)
        return '访客用户名至少 4 个字符'

      return value.includes(' ') ? '用户名不能包含空格' : undefined
    },
    /** 提交前裁剪用户名空白，不改写输入框的实时显示值。 */
    transform: value => value.trim(),
    /** 启用状态关闭时隐藏用户名字段。 */
    visible: values => values.active !== false,
    /** 访客角色不可编辑用户名字段。 */
    disabled: values => values.role === 'guest',
  }),
  defineField({
    field: 'password',
    label: '密码',
    validateOn: 'blur',
    schema: z.string().min(6, '密码至少 6 个字符'),
    span: 12,
    component: Input.Password,
    props: { placeholder: '请输入密码' },
    /**
     * 校验密码不能包含当前用户名。
     *
     * 用户名缺失时只保留 schema 的基础长度校验。
     */
    validator: (value, values) => {
      const username = typeof values.username === 'string' ? values.username.trim() : ''

      return username && value.includes(username) ? '密码不能包含用户名' : undefined
    },
    /** 提交前裁剪密码空白，用于展示字段 transform 的提交边界。 */
    transform: value => value.trim(),
    /** 启用状态关闭时隐藏密码字段。 */
    visible: values => values.active !== false,
    /** 访客角色不可编辑密码字段。 */
    disabled: values => values.role === 'guest',
  }),
  defineField({
    field: 'search',
    label: '搜索',
    schema: z.string().optional(),
    span: 12,
    component: Input.Search,
    props: { placeholder: '输入关键词搜索', allowClear: true },
    /**
     * 校验搜索关键词长度。
     *
     * 空值允许通过，超过展示限制时返回字段级错误。
     */
    validator: (value) => {
      return value && value.length > 30 ? '搜索关键词最多 30 个字符' : undefined
    },
    /** 提交前裁剪可选搜索词，空值保持 undefined。 */
    transform: value => value?.trim(),
    /** 启用状态关闭时隐藏搜索字段。 */
    visible: values => values.active !== false,
    /** 访客角色不可编辑搜索字段。 */
    disabled: values => values.role === 'guest',
  }),
  defineField({
    field: 'email',
    label: '邮箱',
    validateOn: 'blur',
    schema: z.string().email('请输入有效的邮箱地址').optional(),
    span: 12,
    component: Input,
    props: { placeholder: '请输入邮箱', allowClear: true },
    /**
     * 校验管理员邮箱要求。
     *
     * 非管理员角色允许邮箱为空，邮箱格式仍由 schema 处理。
     */
    validator: (value, values) => {
      return values.role === 'admin' && !value ? '管理员需要填写邮箱' : undefined
    },
    /** 提交前裁剪可选邮箱，空值保持 undefined。 */
    transform: value => value?.trim(),
    /** 启用状态关闭时隐藏邮箱字段。 */
    visible: values => values.active !== false,
    /** 访客角色不可编辑邮箱字段。 */
    disabled: values => values.role === 'guest',
  }),
  defineField({
    field: 'phone',
    label: '手机号',
    schema: z.string().regex(/^1[3-9]\d{9}$/, '请输入有效的手机号').optional(),
    span: 12,
    component: Input,
    props: { placeholder: '请输入手机号', allowClear: true },
    /**
     * 校验普通用户手机号要求。
     *
     * 非 user 角色允许手机号为空，号码格式由 schema 处理。
     */
    validator: (value, values) => {
      return values.role === 'user' && !value ? '用户需要填写手机号' : undefined
    },
    /** 提交前裁剪可选手机号，空值保持 undefined。 */
    transform: value => value?.trim(),
    /** 启用状态关闭时隐藏手机号字段。 */
    visible: values => values.active !== false,
    /** 访客角色不可编辑手机号字段。 */
    disabled: values => values.role === 'guest',
  }),

  // 数字输入
  defineField({
    field: 'age',
    label: '年龄',
    schema: z.number().min(1).max(150).optional(),
    span: 8,
    component: InputNumber,
    props: { min: 1, max: 150, placeholder: '年龄', style: { width: '100%' } },
  }),
  defineField({
    field: 'salary',
    label: '薪资',
    schema: z.number().min(0).optional(),
    span: 8,
    component: InputNumber,
    props: { min: 0, step: 1000, placeholder: '薪资', style: { width: '100%' } },
  }),
  defineField({
    field: 'quantity',
    label: '数量',
    schema: z.number().int().min(0).optional(),
    span: 8,
    component: InputNumber,
    props: { min: 0, step: 1, precision: 0, placeholder: '数量', style: { width: '100%' } },
  }),

  // 选择器
  defineField({
    field: 'role',
    label: '角色',
    schema: z.string().min(1, '请选择角色').optional(),
    span: 12,
    component: Select,
    props: {
      placeholder: '请选择角色',
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
    schema: z.array(z.string()).min(1, '请至少选择一个标签').optional(),
    span: 12,
    component: Select,
    props: {
      mode: 'multiple',
      placeholder: '请选择标签',
      allowClear: true,
      options: [
        { label: 'Vue', value: 'vue' },
        { label: 'React', value: 'react' },
        { label: 'Angular', value: 'angular' },
        { label: 'Svelte', value: 'svelte' },
      ],
    },
    defaultValue: [],
  }),
  defineField({
    field: 'department',
    label: '部门',
    schema: z.array(z.string()).min(1, '请选择部门').optional(),
    span: 12,
    component: Cascader,
    props: {
      placeholder: '请选择部门',
      allowClear: true,
      options: [
        {
          value: 'tech', label: '技术部', children: [
            { value: 'frontend', label: '前端组' },
            { value: 'backend', label: '后端组' },
            { value: 'devops', label: '运维组' },
          ],
        },
        {
          value: 'product', label: '产品部', children: [
            { value: 'design', label: '设计组' },
            { value: 'pm', label: '产品组' },
          ],
        },
      ],
    },
  }),
  defineField({
    field: 'manager',
    label: '上级',
    schema: z.string().optional(),
    span: 12,
    component: TreeSelect,
    props: {
      placeholder: '请选择上级',
      allowClear: true,
      treeDefaultExpandAll: true,
      treeData: [
        {
          value: 'ceo', title: 'CEO', children: [
            {
              value: 'cto', title: 'CTO', children: [
                { value: 'lead-fe', title: '前端负责人' },
                { value: 'lead-be', title: '后端负责人' },
              ],
            },
            {
              value: 'cpo', title: 'CPO', children: [
                { value: 'lead-design', title: '设计负责人' },
              ],
            },
          ],
        },
      ],
    },
  }),

  // 单选 / 多选（通过 slots 传递子组件）
  defineField({
    field: 'gender',
    label: '性别',
    schema: z.string().optional(),
    span: 12,
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
    schema: z.array(z.string()).min(1, '请至少选择一项').optional(),
    span: 12,
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
        defineField({
          component: Checkbox,
          props: { value: 'travel' },
          slots: { default: defineField({ component: 'span', props: { textContent: '旅行' } }) },
        }),
      ],
    },
  }),

  // 日期时间
  defineField({
    field: 'birthday',
    label: '出生日期',
    schema: z.unknown().optional(),
    span: 8,
    component: DatePicker,
    props: { placeholder: '选择日期', allowClear: true, style: { width: '100%' } },
    /** 将 DatePicker 的 Dayjs 值转换为 YYYY-MM-DD 提交值。 */
    transform: val => formatDateValue(val, 'YYYY-MM-DD'),
  }),
  defineField({
    field: 'entryTime',
    label: '入职时间',
    schema: z.unknown().optional(),
    span: 8,
    component: TimePicker,
    props: { placeholder: '选择时间', allowClear: true, format: 'HH:mm', style: { width: '100%' } },
    /** 将 TimePicker 的 Dayjs 值转换为 HH:mm 提交值。 */
    transform: val => formatDateValue(val, 'HH:mm'),
  }),
  defineField({
    field: 'dateRange',
    label: '有效期',
    schema: z.unknown().optional(),
    span: 8,
    component: DatePicker.RangePicker,
    props: { placeholder: ['开始日期', '结束日期'], allowClear: true, style: { width: '100%' } },
    /** 将 RangePicker 的 Dayjs 数组转换为日期字符串数组。 */
    transform: val => formatDateRange(val, 'YYYY-MM-DD'),
  }),

  // 开关
  defineField({
    field: 'active',
    label: '启用状态',
    schema: z.boolean().optional(),
    span: 8,
    component: Switch,
    defaultValue: true,
  }),

  // 评分 / 滑块
  defineField({
    field: 'rating',
    label: '评分',
    schema: z.number().min(1, '请评分').max(5).optional(),
    span: 8,
    component: Rate,
    props: { allowHalf: true },
    defaultValue: 0,
  }),
  defineField({
    field: 'progress',
    label: '完成度',
    schema: z.number().min(0).max(100).optional(),
    span: 8,
    component: Slider,
    defaultValue: 0,
  }),

  // 自动补全
  defineField({
    field: 'city',
    label: '城市',
    schema: z.string().optional(),
    span: 12,
    component: AutoComplete,
    props: {
      placeholder: '输入城市名',
      allowClear: true,
      options: ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '重庆'].map(c => ({ value: c })),
      filterOption: optionIncludes,
    },
  }),

  // 条件显隐：性别选"其他"时显示
  defineField({
    field: 'genderOther',
    label: '请说明',
    schema: z.string().min(1, '请说明您的性别').optional(),
    span: 12,
    component: Input,
    props: { placeholder: '请说明您的性别', allowClear: true },
    /** 仅在性别选择“其他”时展示补充说明字段。 */
    visible: (values) => values.gender === 'other',
  }),

  // 条件显隐：启用状态下显示生效日期
  defineField({
    field: 'effectiveDate',
    label: '生效日期',
    schema: z.unknown().optional(),
    span: 12,
    component: DatePicker,
    props: { placeholder: '选择生效日期', allowClear: true, style: { width: '100%' } },
    /** 将生效日期转换为 YYYY-MM-DD 提交值。 */
    transform: val => formatDateValue(val, 'YYYY-MM-DD'),
    /** 仅在表单启用时展示生效日期。 */
    visible: (values) => values.active === true,
  }),

  // 条件禁用：角色为"访客"时禁用
  defineField({
    field: 'remark',
    label: '备注',
    schema: z.string().max(100, '备注最多 100 个字符').optional(),
    span: 24,
    component: Input,
    props: { placeholder: '访客不可编辑备注', allowClear: true },
    /** 访客角色不可编辑备注。 */
    disabled: (values) => values.role === 'guest',
  }),

  // 条件禁用：评分低于3时禁用提交建议
  defineField({
    field: 'suggestion',
    label: '建议',
    schema: z.string().max(200, '建议最多 200 个字符').optional(),
    span: 24,
    component: Textarea,
    props: { placeholder: '评分达到 3 分后可填写建议', rows: 2, allowClear: true },
    /**
     * 评分低于 3 分时禁用建议字段。
     *
     * 非数字评分按 0 处理，保持示例在初始态下不可编辑。
     */
    disabled: (values) => {
      const rating = typeof values.rating === 'number' ? values.rating : 0
      return rating < 3
    },
  }),

  // 文本域
  defineField({
    field: 'bio',
    label: '个人简介',
    schema: z.string().max(200, '简介最多 200 个字符').optional(),
    span: 24,
    component: Textarea,
    props: { placeholder: '请输入个人简介', rows: 3, showCount: true, maxlength: 200 },
  }),
]

/**
 * 展示表单提交结果。
 *
 * playground 通过 alert 直接反馈提交值，不向远端接口发送数据。
 */
function onSubmit(values: Record<string, unknown>) {
  Object.assign(formValues, values)
  alert(`提交成功！\n${JSON.stringify(values, null, 2)}`)
}

/**
 * 输出表单校验失败结果。
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
      :default-values="formValues"
      namespace="moluoxixi"
      :fields="fields"
      :runtime="runtimeOptions"
      label-width="80px"
      @submit="onSubmit"
      @error="onError"
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
