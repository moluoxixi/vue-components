import type { ConfigFormCondition, ConfigFormNode, DefineConfigFormFieldFactory } from '@moluoxixi/config-form-headless'
import type { AntdFieldKey, AntdKnownValues, AntdLinkedValues, AntdOption, AntdTreeOption } from '../types'
import { defineFields } from '@moluoxixi/config-form-headless'
import {
  AutoComplete as AAutoComplete,
  Card as ACard,
  Cascader as ACascader,
  Checkbox as ACheckbox,
  Collapse as ACollapse,
  CollapsePanel as ACollapsePanel,
  DatePicker as ADatePicker,
  Input as AInput,
  InputNumber as AInputNumber,
  Radio as ARadio,
  Rate as ARate,
  Select as ASelect,
  Slider as ASlider,
  Switch as ASwitch,
  TabPane as ATabPane,
  Tabs as ATabs,
  TimePicker as ATimePicker,
  TimeRangePicker as ATimeRangePicker,
  TreeSelect as ATreeSelect,
} from 'ant-design-vue'
import { h } from 'vue'
import { z } from 'zod'

const ATextarea = AInput.TextArea
const AInputPassword = AInput.Password
const AInputSearch = AInput.Search
const ACheckboxGroup = ACheckbox.Group
const ARadioGroup = ARadio.Group
const ARangePicker = ADatePicker.RangePicker
const { defineField: defineCommonField } = defineFields<AntdKnownValues>()
const { defineField: defineLinkedField } = defineFields<AntdLinkedValues>()

export function createAntdKnownValues(seed: string): AntdKnownValues {
  return {
    autoComplete: `${seed} 推荐项`,
    cascader: [`${seed}-east`, `${seed}-hangzhou`],
    checkbox: false,
    checkboxGroup: [],
    date: '2026-06-01',
    input: '',
    inputNumber: 1,
    password: '',
    radio: 'standard',
    range: ['2026-06-01', '2026-06-03'],
    rate: 1,
    search: '',
    select: `${seed}-draft`,
    slider: 10,
    switchValue: false,
    textarea: '',
    time: '09:00:00',
    timeRange: ['09:00:00', '10:00:00'],
    treeSelect: `${seed}-root-a`,
  }
}

export function createAntdLinkedValues(): AntdLinkedValues {
  return {
    ...createAntdKnownValues('linked'),
    advanced: false,
    enterpriseName: '',
    marketing: false,
    marketingNote: '',
    notifyChannel: 'immediate',
    planType: 'standard',
    scheduledTime: '10:00:00',
    seatCount: 1,
    seatNote: '',
  }
}

export function createAntdKnownFields<TValues extends AntdKnownValues>(
  prefix: string,
  withFormItem: boolean,
  defineField: DefineConfigFormFieldFactory<TValues>,
  visible?: ConfigFormCondition<TValues>,
): ConfigFormNode<TValues>[] {
  const suffix = prefix.replace('antd-', '')

  return [
    defineField({
      component: AInput,
      field: 'input' as AntdFieldKey<TValues>,
      id: `${prefix}-input`,
      label: withFormItem ? '文本输入' : undefined,
      props: { 'placeholder': `${prefix} 文本输入`, 'data-testid': `${prefix}-input` },
      span: 12,
      visible,
    }),
    defineField({
      component: ATextarea,
      field: 'textarea' as AntdFieldKey<TValues>,
      id: `${prefix}-textarea`,
      label: withFormItem ? '多行文本' : undefined,
      props: { 'placeholder': `${prefix} 多行文本`, 'rows': 2, 'data-testid': `${prefix}-textarea` },
      span: 24,
      visible,
    }),
    defineField({
      component: AInputPassword,
      field: 'password' as AntdFieldKey<TValues>,
      id: `${prefix}-password`,
      label: withFormItem ? '密码输入' : undefined,
      props: { 'placeholder': `${prefix} 密码输入`, 'data-testid': `${prefix}-password` },
      span: 12,
      visible,
    }),
    defineField({
      component: AInputSearch,
      field: 'search' as AntdFieldKey<TValues>,
      id: `${prefix}-search`,
      label: withFormItem ? '搜索输入' : undefined,
      props: { 'placeholder': `${prefix} 搜索输入`, 'data-testid': `${prefix}-search` },
      span: 12,
      visible,
    }),
    defineField({
      component: AInputNumber,
      field: 'inputNumber' as AntdFieldKey<TValues>,
      id: `${prefix}-input-number`,
      label: withFormItem ? '数字输入' : undefined,
      props: { 'max': 99, 'min': 0, 'data-testid': `${prefix}-input-number` },
      span: 12,
      visible,
    }),
    defineField({
      component: AAutoComplete,
      field: 'autoComplete' as AntdFieldKey<TValues>,
      id: `${prefix}-auto-complete`,
      label: withFormItem ? '自动完成' : undefined,
      props: { 'options': createFlatOptions(suffix), 'placeholder': `${prefix} 自动完成`, 'data-testid': `${prefix}-auto-complete` },
      span: 12,
      visible,
    }),
    defineField({
      component: ASelect,
      field: 'select' as AntdFieldKey<TValues>,
      id: `${prefix}-select`,
      label: withFormItem ? '下拉选择' : undefined,
      props: { 'options': createFlatOptions(suffix), 'placeholder': `${prefix} 下拉选择`, 'data-testid': `${prefix}-select` },
      span: 12,
      visible,
    }),
    defineField({
      component: ACascader,
      field: 'cascader' as AntdFieldKey<TValues>,
      id: `${prefix}-cascader`,
      label: withFormItem ? '级联选择' : undefined,
      props: { 'options': createNestedOptions(suffix), 'placeholder': `${prefix} 级联选择`, 'data-testid': `${prefix}-cascader` },
      span: 12,
      visible,
    }),
    defineField({
      component: ATreeSelect,
      field: 'treeSelect' as AntdFieldKey<TValues>,
      id: `${prefix}-tree-select`,
      label: withFormItem ? '树形选择' : undefined,
      props: { 'placeholder': `${prefix} 树形选择`, 'treeData': createTreeOptions(suffix), 'data-testid': `${prefix}-tree-select` },
      span: 12,
      visible,
    }),
    defineField({
      component: ACheckbox,
      field: 'checkbox' as AntdFieldKey<TValues>,
      id: `${prefix}-checkbox`,
      label: withFormItem ? '单选勾选' : undefined,
      props: { 'data-testid': `${prefix}-checkbox` },
      slots: { default: () => `${suffix} 开启` },
      span: 12,
      visible,
    }),
    defineField({
      component: ACheckboxGroup,
      field: 'checkboxGroup' as AntdFieldKey<TValues>,
      id: `${prefix}-checkbox-group`,
      label: withFormItem ? '多选勾选' : undefined,
      props: { 'options': createCheckOptions(suffix), 'data-testid': `${prefix}-checkbox-group` },
      span: 12,
      visible,
    }),
    defineField({
      component: ASwitch,
      field: 'switchValue' as AntdFieldKey<TValues>,
      id: `${prefix}-switch`,
      label: withFormItem ? '开关' : undefined,
      props: { 'checkedChildren': '开启', 'unCheckedChildren': '关闭', 'data-testid': `${prefix}-switch` },
      span: 12,
      visible,
    }),
    defineField({
      component: ARadioGroup,
      field: 'radio' as AntdFieldKey<TValues>,
      id: `${prefix}-radio`,
      label: withFormItem ? '单选组' : undefined,
      props: { 'options': createRadioOptions(), 'data-testid': `${prefix}-radio` },
      span: 12,
      visible,
    }),
    defineField({
      component: ARate,
      field: 'rate' as AntdFieldKey<TValues>,
      id: `${prefix}-rate`,
      label: withFormItem ? '评分' : undefined,
      props: { 'data-testid': `${prefix}-rate` },
      span: 12,
      visible,
    }),
    defineField({
      component: ASlider,
      field: 'slider' as AntdFieldKey<TValues>,
      id: `${prefix}-slider`,
      label: withFormItem ? '滑块' : undefined,
      props: { 'max': 100, 'min': 0, 'style': { width: '160px' }, 'data-testid': `${prefix}-slider` },
      span: 12,
      visible,
    }),
    defineField({
      component: ADatePicker,
      field: 'date' as AntdFieldKey<TValues>,
      id: `${prefix}-date`,
      label: withFormItem ? '日期' : undefined,
      props: { 'placeholder': `${prefix} 日期`, 'valueFormat': 'YYYY-MM-DD', 'data-testid': `${prefix}-date` },
      span: 12,
      visible,
    }),
    defineField({
      component: ARangePicker,
      field: 'range' as AntdFieldKey<TValues>,
      id: `${prefix}-range`,
      label: withFormItem ? '日期范围' : undefined,
      props: { 'placeholder': [`${prefix} 开始日期`, `${prefix} 结束日期`], 'valueFormat': 'YYYY-MM-DD', 'data-testid': `${prefix}-range` },
      span: 12,
      visible,
    }),
    defineField({
      component: ATimePicker,
      field: 'time' as AntdFieldKey<TValues>,
      id: `${prefix}-time`,
      label: withFormItem ? '时间' : undefined,
      props: { 'placeholder': `${prefix} 时间`, 'valueFormat': 'HH:mm:ss', 'data-testid': `${prefix}-time` },
      span: 12,
      visible,
    }),
    defineField({
      component: ATimeRangePicker,
      field: 'timeRange' as AntdFieldKey<TValues>,
      id: `${prefix}-time-range`,
      label: withFormItem ? '时间范围' : undefined,
      props: { 'placeholder': [`${prefix} 开始时间`, `${prefix} 结束时间`], 'valueFormat': 'HH:mm:ss', 'data-testid': `${prefix}-time-range` },
      span: 12,
      visible,
    }),
  ]
}

export const antdContainerFields: ConfigFormNode<AntdKnownValues>[] = [
  defineCommonField({
    cellAttrs: {},
    component: ACard,
    id: 'antd-container-card',
    span: 24,
    props: { 'class': 'config-form-demo__container-card', 'data-testid': 'antd-container-node', 'size': 'small', 'title': 'Antd Card 容器' },
    slots: { default: createAntdKnownFields('antd-container', false, defineCommonField) },
  }),
  defineCommonField({
    cellAttrs: {},
    component: ACollapse,
    id: 'antd-container-collapse',
    span: 24,
    props: { 'class': 'config-form-demo__container-collapse', 'defaultActiveKey': ['profile'], 'data-testid': 'antd-container-collapse-node' },
    slots: {
      default: defineCommonField({
        cellAttrs: {},
        component: ACollapsePanel,
        id: 'antd-container-collapse-panel',
        props: { header: 'Antd Collapse 容器', key: 'profile' },
        slots: {
          default: defineCommonField({
            cellAttrs: {},
            component: 'p',
            id: 'antd-container-collapse-content',
            props: { textContent: 'Collapse 容器承载非字段配置节点' },
          }),
        },
      }),
    },
  }),
  defineCommonField({
    cellAttrs: {},
    component: ATabs,
    id: 'antd-container-tabs',
    span: 24,
    props: { 'activeKey': 'base', 'class': 'config-form-demo__container-tabs', 'data-testid': 'antd-container-tabs-node' },
    slots: {
      default: [
        defineCommonField({
          cellAttrs: {},
          component: ATabPane,
          id: 'antd-container-tab-base',
          props: { key: 'base', tab: '基础' },
          slots: { default: defineCommonField({ cellAttrs: {}, component: 'p', id: 'antd-container-tab-base-content', props: { textContent: 'Tabs 基础容器内容' } }) },
        }),
        defineCommonField({
          cellAttrs: {},
          component: ATabPane,
          id: 'antd-container-tab-preference',
          props: { key: 'preference', tab: '偏好' },
          slots: { default: defineCommonField({ cellAttrs: {}, component: 'p', id: 'antd-container-tab-preference-content', props: { textContent: 'Tabs 偏好容器内容' } }) },
        }),
      ],
    },
  }),
]

export const antdLinkedFields: ConfigFormNode<AntdLinkedValues>[] = [
  defineLinkedField({
    component: ASwitch,
    field: 'advanced',
    id: 'antd-linked-advanced',
    label: '高级模式',
    props: { 'checkedChildren': '启用', 'unCheckedChildren': '关闭', 'data-testid': 'antd-linked-advanced-switch' },
    span: 12,
  }),
  ...createAntdKnownFields('antd-linked', true, defineLinkedField, values => values.advanced),
  defineLinkedField({
    component: ARadioGroup,
    field: 'planType',
    id: 'antd-linked-plan-type',
    label: '方案类型',
    props: { 'options': createRadioOptions(), 'data-testid': 'antd-linked-plan-radio' },
    span: 12,
  }),
  defineLinkedField({
    component: AInput,
    field: 'enterpriseName',
    id: 'antd-linked-enterprise-name',
    label: '企业名称',
    props: { 'placeholder': '企业模式显示', 'data-testid': 'antd-linked-enterprise-name' },
    readonly: values => values.marketing,
    readonlyRender: ({ value }) => h('span', { 'data-testid': 'antd-linked-enterprise-name-readonly' }, `已锁定：${String(value || '未填写')}`),
    required: true,
    requiredMessage: '请输入企业名称',
    schema: z.string().trim().min(2, '企业名称至少 2 个字符'),
    span: 12,
    validateOn: 'blur',
    visible: values => values.planType === 'enterprise',
  }),
  defineLinkedField({
    component: ACheckbox,
    field: 'marketing',
    id: 'antd-linked-marketing',
    label: '营销设置',
    props: { 'data-testid': 'antd-linked-marketing-checkbox' },
    slots: { default: () => '启用营销备注' },
    span: 12,
  }),
  defineLinkedField({
    component: ATextarea,
    field: 'marketingNote',
    id: 'antd-linked-marketing-note',
    label: '营销备注',
    props: { 'placeholder': '勾选后显示', 'rows': 2, 'data-testid': 'antd-linked-marketing-note' },
    span: 12,
    visible: values => values.marketing,
  }),
  defineLinkedField({
    component: ASelect,
    field: 'notifyChannel',
    id: 'antd-linked-notify-channel',
    label: '通知方式',
    props: { 'options': createNotifyOptions(), 'placeholder': '选择通知方式', 'data-testid': 'antd-linked-notify-channel' },
    span: 12,
  }),
  defineLinkedField({
    component: ATimePicker,
    field: 'scheduledTime',
    id: 'antd-linked-scheduled-time',
    label: '预约时间',
    props: { 'valueFormat': 'HH:mm:ss', 'data-testid': 'antd-linked-scheduled-time' },
    span: 12,
    visible: values => values.notifyChannel === 'scheduled',
  }),
  defineLinkedField({
    component: AInputNumber,
    field: 'seatCount',
    id: 'antd-linked-seat-count',
    label: '席位数',
    props: { 'max': 99, 'min': 1, 'data-testid': 'antd-linked-seat-count' },
    span: 12,
  }),
  defineLinkedField({
    component: ATextarea,
    field: 'seatNote',
    id: 'antd-linked-seat-note',
    label: '席位说明',
    props: { 'placeholder': '席位数达到 5 后显示', 'rows': 2, 'data-testid': 'antd-linked-seat-note' },
    span: 12,
    visible: values => values.seatCount >= 5,
  }),
]

function createFlatOptions(suffix: string): AntdOption[] {
  return [
    { label: `${suffix} 草稿`, value: `${suffix}-draft` },
    { label: `${suffix} 启用`, value: `${suffix}-enabled` },
  ]
}

function createNestedOptions(suffix: string): AntdOption[] {
  return [{
    label: `${suffix} 华东`,
    value: `${suffix}-east`,
    children: [
      { label: `${suffix} 杭州`, value: `${suffix}-hangzhou` },
      { label: `${suffix} 上海`, value: `${suffix}-shanghai` },
    ],
  }]
}

function createTreeOptions(suffix: string): AntdTreeOption[] {
  return [{
    title: `${suffix} 根节点`,
    value: `${suffix}-root-a`,
    children: [{ title: `${suffix} 叶子节点`, value: `${suffix}-leaf-a` }],
  }]
}

function createCheckOptions(suffix: string): AntdOption[] {
  return [
    { label: `${suffix} 邮件`, value: 'mail' },
    { label: `${suffix} 短信`, value: 'sms' },
  ]
}

function createRadioOptions(): AntdOption[] {
  return [
    { label: '标准', value: 'standard' },
    { label: '企业', value: 'enterprise' },
  ]
}

function createNotifyOptions(): AntdOption[] {
  return [
    { label: '立即通知', value: 'immediate' },
    { label: '预约通知', value: 'scheduled' },
  ]
}
