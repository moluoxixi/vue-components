<script setup lang="ts">
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { ElAutocomplete, ElCascader, ElCheckbox, ElCheckboxGroup, ElColorPicker, ElDatePicker, ElInput, ElInputNumber, ElRadio, ElRadioGroup, ElRate, ElSelectV2, ElSlider, ElSwitch, ElTimePicker, ElTimeSelect, ElTreeSelect } from 'element-plus'

import { reactive, ref } from 'vue'
import { z } from 'zod'

const formRef = ref()
const formValues = reactive<Record<string, unknown>>({})

const fields = [
  // 文本输入
  defineField({
    field: 'username',
    label: '用户名',
    validateOn: ['blur', 'change'],
    schema: z.string().min(2, '用户名至少 2 个字符').max(20, '用户名最多 20 个字符'),
    span: 12,
    component: ElInput,
    props: { placeholder: '请输入用户名', clearable: true },
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
    /** 启用状态关闭时隐藏用户名字段，示例 active 对字段树的控制能力。 */
    visible: values => values.active !== false,
    /** 访客角色不可编辑用户名，示例角色驱动的禁用规则。 */
    disabled: values => values.role === 'guest',
  }),
  defineField({
    field: 'password',
    label: '密码',
    validateOn: 'blur',
    schema: z.string().min(6, '密码至少 6 个字符'),
    span: 12,
    component: ElInput,
    props: { type: 'password', placeholder: '请输入密码', showPassword: true },
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
    field: 'email',
    label: '邮箱',
    validateOn: 'blur',
    schema: z.string().email('请输入有效的邮箱地址').optional(),
    span: 12,
    component: ElInput,
    props: { placeholder: '请输入邮箱', clearable: true },
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
    component: ElInput,
    props: { placeholder: '请输入手机号', clearable: true },
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
    component: ElInputNumber,
    props: { min: 1, max: 150, placeholder: '年龄', controlsPosition: 'right' },
  }),
  defineField({
    field: 'salary',
    label: '薪资',
    schema: z.number().min(0).optional(),
    span: 8,
    component: ElInputNumber,
    props: { min: 0, step: 1000, placeholder: '薪资', controlsPosition: 'right' },
  }),
  defineField({
    field: 'quantity',
    label: '数量',
    schema: z.number().int().min(0).optional(),
    span: 8,
    component: ElInputNumber,
    props: { min: 0, step: 1, precision: 0, placeholder: '数量', controlsPosition: 'right' },
  }),

  // 选择器
  defineField({
    field: 'role',
    label: '角色',
    schema: z.string().min(1, '请选择角色').optional(),
    span: 12,
    component: ElSelectV2,
    props: {
      placeholder: '请选择角色',
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
    schema: z.array(z.string()).min(1, '请至少选择一个标签').optional(),
    span: 12,
    component: ElSelectV2,
    props: {
      multiple: true,
      placeholder: '请选择标签',
      clearable: true,
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
    field: 'city',
    label: '城市',
    schema: z.string().optional(),
    span: 12,
    component: ElSelectV2,
    props: {
      filterable: true,
      placeholder: '可搜索选择城市',
      clearable: true,
      options: [
        { label: '北京', value: 'beijing' },
        { label: '上海', value: 'shanghai' },
        { label: '广州', value: 'guangzhou' },
        { label: '深圳', value: 'shenzhen' },
        { label: '杭州', value: 'hangzhou' },
        { label: '成都', value: 'chengdu' },
      ],
    },
  }),
  defineField({
    field: 'department',
    label: '部门',
    schema: z.array(z.string()).min(1, '请选择部门').optional(),
    span: 12,
    component: ElCascader,
    props: {
      placeholder: '请选择部门',
      clearable: true,
      options: [
        {
          value: 'tech',
          label: '技术部',
          children: [
            { value: 'frontend', label: '前端组' },
            { value: 'backend', label: '后端组' },
            { value: 'devops', label: '运维组' },
          ],
        },
        {
          value: 'product',
          label: '产品部',
          children: [
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
    component: ElTreeSelect,
    props: {
      placeholder: '请选择上级',
      clearable: true,
      checkStrictly: true,
      data: [
        {
          value: 'ceo',
          label: 'CEO',
          children: [
            {
              value: 'cto',
              label: 'CTO',
              children: [
                { value: 'lead-fe', label: '前端负责人' },
                { value: 'lead-be', label: '后端负责人' },
              ],
            },
            {
              value: 'cpo',
              label: 'CPO',
              children: [
                { value: 'lead-design', label: '设计负责人' },
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
    schema: z.array(z.string()).min(1, '请至少选择一项').optional(),
    span: 12,
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
        defineField({
          component: ElCheckbox,
          props: { value: 'travel', label: '旅行' },
        }),
      ],
    },
  }),

  // 日期时间
  defineField({
    field: 'birthday',
    label: '出生日期',
    schema: z.string().optional(),
    span: 8,
    component: ElDatePicker,
    props: { type: 'date', placeholder: '选择日期', valueFormat: 'YYYY-MM-DD', clearable: true },
  }),
  defineField({
    field: 'entryDate',
    label: '入职时间',
    schema: z.string().optional(),
    span: 8,
    component: ElDatePicker,
    props: { type: 'datetime', placeholder: '选择日期时间', valueFormat: 'YYYY-MM-DD HH:mm:ss', clearable: true },
  }),
  defineField({
    field: 'dateRange',
    label: '有效期',
    schema: z.array(z.string()).optional(),
    span: 8,
    component: ElDatePicker,
    props: { type: 'daterange', startPlaceholder: '开始日期', endPlaceholder: '结束日期', valueFormat: 'YYYY-MM-DD', clearable: true },
    defaultValue: [],
  }),
  defineField({
    field: 'workTime',
    label: '上班时间',
    schema: z.string().optional(),
    span: 8,
    component: ElTimeSelect,
    props: { placeholder: '选择时间', start: '06:00', step: '00:15', end: '22:00', clearable: true },
  }),
  defineField({
    field: 'meetingTime',
    label: '会议时间',
    schema: z.string().optional(),
    span: 8,
    component: ElTimePicker,
    props: { placeholder: '选择时间', valueFormat: 'HH:mm:ss', clearable: true },
  }),
  defineField({
    field: 'month',
    label: '月份',
    schema: z.string().optional(),
    span: 8,
    component: ElDatePicker,
    props: { type: 'month', placeholder: '选择月份', valueFormat: 'YYYY-MM', clearable: true },
  }),

  // 开关 / 评分 / 颜色
  defineField({
    field: 'active',
    label: '启用状态',
    schema: z.boolean().optional(),
    span: 8,
    component: ElSwitch,
    defaultValue: true,
  }),
  defineField({
    field: 'rating',
    label: '评分',
    schema: z.number().min(1, '请评分').max(5).optional(),
    span: 8,
    component: ElRate,
    props: { allowHalf: true, showScore: true },
    defaultValue: 0,
  }),
  defineField({
    field: 'themeColor',
    label: '主题色',
    schema: z.string().optional(),
    span: 8,
    component: ElColorPicker,
    defaultValue: '#409EFF',
  }),

  // 滑块（需要较大宽度）
  defineField({
    field: 'progress',
    label: '完成度',
    schema: z.number().min(0).max(100).optional(),
    span: 24,
    component: ElSlider,
    props: { showInput: true },
    defaultValue: 0,
  }),

  // 自动补全
  defineField({
    field: 'cityName',
    label: '城市名',
    schema: z.string().optional(),
    span: 12,
    component: ElAutocomplete,
    props: {
      placeholder: '输入城市名',
      clearable: true,
      /**
       * 为 Element Plus 自动补全提供城市候选项。
       *
       * 只在本地示例数据中筛选，结果通过组件要求的回调返回。
       */
      fetchSuggestions: (queryString: string, cb: (items: Array<{ value: string }>) => void) => {
        const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '重庆']
        const results = queryString
          ? cities.filter(c => c.includes(queryString)).map(c => ({ value: c }))
          : cities.map(c => ({ value: c }))
        cb(results)
      },
    },
  }),

  // 条件显隐：性别选"其他"时显示
  defineField({
    field: 'genderOther',
    label: '请说明',
    schema: z.string().min(1, '请说明您的性别').optional(),
    span: 12,
    component: ElInput,
    props: { placeholder: '请说明您的性别', clearable: true },
    /** 仅在性别选择“其他”时展示补充说明字段。 */
    visible: values => values.gender === 'other',
  }),

  // 条件显隐：启用状态下显示生效日期
  defineField({
    field: 'effectiveDate',
    label: '生效日期',
    schema: z.string().optional(),
    span: 12,
    component: ElDatePicker,
    props: { type: 'date', placeholder: '选择生效日期', valueFormat: 'YYYY-MM-DD', clearable: true },
    /** 仅在表单启用时展示生效日期。 */
    visible: values => values.active === true,
  }),

  // 条件禁用：角色为"访客"时禁用
  defineField({
    field: 'remark',
    label: '备注',
    schema: z.string().max(100, '备注最多 100 个字符').optional(),
    span: 24,
    component: ElInput,
    props: { placeholder: '访客不可编辑备注', clearable: true },
    /** 访客角色不可编辑备注。 */
    disabled: values => values.role === 'guest',
  }),

  // 条件禁用：评分低于3时禁用提交建议
  defineField({
    field: 'suggestion',
    label: '建议',
    schema: z.string().max(200, '建议最多 200 个字符').optional(),
    span: 24,
    component: ElInput,
    props: { type: 'textarea', placeholder: '评分达到 3 分后可填写建议', rows: 2, clearable: true },
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
    component: ElInput,
    props: { type: 'textarea', placeholder: '请输入个人简介', rows: 3, maxlength: 200, showWordLimit: true },
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
      label-width="80px"
      @submit="onSubmit"
      @error="onError"
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
