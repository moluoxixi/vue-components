import type { ConfigFormCondition, ConfigFormNode, DefineConfigFormFieldFactory } from '@moluoxixi/config-form-headless'
import type { ElementFieldKey, ElementKnownValues, ElementLinkedValues, ElementOption, ElementStressValues } from '../types'
import { defineFields } from '@moluoxixi/config-form-headless'
import {
  ElAutocomplete,
  ElCard,
  ElCascader,
  ElCheckbox,
  ElCheckboxGroup,
  ElCollapse,
  ElCollapseItem,
  ElColorPicker,
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElRate,
  ElSelect,
  ElSelectV2,
  ElSlider,
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTimePicker,
  ElTimeSelect,
  ElTreeSelect,
} from 'element-plus'
import { h } from 'vue'
import { z } from 'zod'

export const ELEMENT_STRESS_FIELD_COUNT = 200

const { defineField: defineCommonField } = defineFields<ElementKnownValues>()
const { defineField: defineLinkedField } = defineFields<ElementLinkedValues>()
const { defineField: defineStressField } = defineFields<ElementStressValues>()

export function createElementKnownValues(seed: string): ElementKnownValues {
  return {
    autocomplete: `${seed} 推荐项`,
    cascader: `${seed}-hangzhou`,
    checkbox: false,
    checkboxGroup: [],
    color: '#409EFF',
    date: '2026-06-01',
    input: '',
    inputNumber: 1,
    radio: 'standard',
    rate: 1,
    select: `${seed}-draft`,
    selectV2: `${seed}-small`,
    slider: 10,
    switchValue: false,
    textarea: '',
    time: '09:00:00',
    timeSelect: '09:00',
    treeSelect: `${seed}-root-a`,
  }
}

export function createElementLinkedValues(): ElementLinkedValues {
  return {
    ...createElementKnownValues('linked'),
    advanced: false,
    enterpriseName: '',
    marketing: false,
    marketingNote: '',
    notifyChannel: 'immediate',
    planType: 'standard',
    scheduledTime: '10:00',
    seatCount: 1,
    seatNote: '',
  }
}

export function createElementStressValues(): ElementStressValues {
  return Object.fromEntries(
    Array.from({ length: ELEMENT_STRESS_FIELD_COUNT }, (_, index) => {
      const number = index + 1
      return [`stressField${number}`, `布局压测 ${number}`]
    }),
  )
}

export const elementStressFields: ConfigFormNode<ElementStressValues>[] = Array.from(
  { length: ELEMENT_STRESS_FIELD_COUNT },
  (_, index) => {
    const number = index + 1
    const field = `stressField${number}`
    return defineStressField({
      component: ElInput,
      field,
      id: `element-stress-${field}`,
      label: `压测 ${number}`,
      props: { 'placeholder': `布局压测字段 ${number}`, 'data-testid': `element-layout-stress-input-${number}` },
      span: 6,
    })
  },
)

export function createElementKnownFields<TValues extends ElementKnownValues>(
  prefix: string,
  withFormItem: boolean,
  defineField: DefineConfigFormFieldFactory<TValues>,
  visible?: ConfigFormCondition<TValues>,
): ConfigFormNode<TValues>[] {
  const suffix = prefix.replace('element-', '')

  return [
    defineField({
      component: ElInput,
      field: 'input' as ElementFieldKey<TValues>,
      id: `${prefix}-input`,
      label: withFormItem ? '文本输入' : undefined,
      props: { 'placeholder': `${prefix} 文本输入`, 'data-testid': `${prefix}-input` },
      span: 12,
      visible,
    }),
    defineField({
      component: ElInput,
      field: 'textarea' as ElementFieldKey<TValues>,
      id: `${prefix}-textarea`,
      label: withFormItem ? '多行文本' : undefined,
      props: { 'placeholder': `${prefix} 多行文本`, 'rows': 2, 'type': 'textarea', 'data-testid': `${prefix}-textarea` },
      span: 24,
      visible,
    }),
    defineField({
      component: ElInputNumber,
      field: 'inputNumber' as ElementFieldKey<TValues>,
      id: `${prefix}-input-number`,
      label: withFormItem ? '数字输入' : undefined,
      props: { 'max': 99, 'min': 0, 'data-testid': `${prefix}-input-number` },
      span: 12,
      visible,
    }),
    defineField({
      component: ElAutocomplete,
      field: 'autocomplete' as ElementFieldKey<TValues>,
      id: `${prefix}-autocomplete`,
      label: withFormItem ? '自动完成' : undefined,
      props: {
        'fetchSuggestions': (_query: string, callback: (items: ElementOption[]) => void) => callback(createFlatOptions(suffix)),
        'placeholder': `${prefix} 自动完成`,
        'teleported': false,
        'data-testid': `${prefix}-autocomplete`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElSelect,
      field: 'select' as ElementFieldKey<TValues>,
      id: `${prefix}-select`,
      label: withFormItem ? '下拉选择' : undefined,
      props: { 'placeholder': `${prefix} 下拉选择`, 'teleported': false, 'data-testid': `${prefix}-select` },
      slots: {
        default: createFlatOptions(suffix).map(option => defineField({
          cellAttrs: {},
          component: ElOption,
          id: `${prefix}-select-option-${String(option.value)}`,
          props: option,
        })),
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElSelectV2,
      field: 'selectV2' as ElementFieldKey<TValues>,
      id: `${prefix}-select-v2`,
      label: withFormItem ? '虚拟选择' : undefined,
      props: { 'options': createSelectV2Options(suffix), 'placeholder': `${prefix} 虚拟选择`, 'teleported': false, 'data-testid': `${prefix}-select-v2` },
      span: 12,
      visible,
    }),
    defineField({
      component: ElCascader,
      field: 'cascader' as ElementFieldKey<TValues>,
      id: `${prefix}-cascader`,
      label: withFormItem ? '级联选择' : undefined,
      props: { 'options': createNestedOptions(suffix), 'placeholder': `${prefix} 级联选择`, 'props': { emitPath: false }, 'teleported': false, 'data-testid': `${prefix}-cascader` },
      span: 12,
      visible,
    }),
    defineField({
      component: ElTreeSelect,
      field: 'treeSelect' as ElementFieldKey<TValues>,
      id: `${prefix}-tree-select`,
      label: withFormItem ? '树形选择' : undefined,
      props: { 'data': createTreeOptions(suffix), 'placeholder': `${prefix} 树形选择`, 'renderAfterExpand': false, 'teleported': false, 'data-testid': `${prefix}-tree-select` },
      span: 12,
      visible,
    }),
    defineField({
      component: ElCheckbox,
      field: 'checkbox' as ElementFieldKey<TValues>,
      id: `${prefix}-checkbox`,
      label: withFormItem ? '单选勾选' : undefined,
      props: { 'label': `${suffix} 开启`, 'data-testid': `${prefix}-checkbox` },
      span: 12,
      visible,
    }),
    defineField({
      component: ElCheckboxGroup,
      field: 'checkboxGroup' as ElementFieldKey<TValues>,
      id: `${prefix}-checkbox-group`,
      label: withFormItem ? '多选勾选' : undefined,
      props: { 'data-testid': `${prefix}-checkbox-group` },
      slots: {
        default: createCheckOptions(suffix).map(option => defineField({
          cellAttrs: {},
          component: ElCheckbox,
          id: `${prefix}-checkbox-option-${String(option.value)}`,
          props: option,
        })),
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElSwitch,
      field: 'switchValue' as ElementFieldKey<TValues>,
      id: `${prefix}-switch`,
      label: withFormItem ? '开关' : undefined,
      props: { 'activeText': '开启', 'inactiveText': '关闭', 'data-testid': `${prefix}-switch` },
      span: 12,
      visible,
    }),
    defineField({
      component: ElRadioGroup,
      field: 'radio' as ElementFieldKey<TValues>,
      id: `${prefix}-radio`,
      label: withFormItem ? '单选组' : undefined,
      props: { 'data-testid': `${prefix}-radio` },
      slots: {
        default: createRadioOptions().map(option => defineField({
          cellAttrs: {},
          component: ElRadio,
          id: `${prefix}-radio-option-${String(option.value)}`,
          props: option,
        })),
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElRate,
      field: 'rate' as ElementFieldKey<TValues>,
      id: `${prefix}-rate`,
      label: withFormItem ? '评分' : undefined,
      props: { 'data-testid': `${prefix}-rate` },
      span: 12,
      visible,
    }),
    defineField({
      component: ElSlider,
      field: 'slider' as ElementFieldKey<TValues>,
      id: `${prefix}-slider`,
      label: withFormItem ? '滑块' : undefined,
      props: { 'max': 100, 'min': 0, 'data-testid': `${prefix}-slider` },
      span: 12,
      visible,
    }),
    defineField({
      component: ElColorPicker,
      field: 'color' as ElementFieldKey<TValues>,
      id: `${prefix}-color`,
      label: withFormItem ? '颜色' : undefined,
      props: { 'predefine': ['#409EFF', '#67C23A', '#E6A23C'], 'teleported': false, 'data-testid': `${prefix}-color` },
      span: 12,
      visible,
    }),
    defineField({
      component: ElDatePicker,
      field: 'date' as ElementFieldKey<TValues>,
      id: `${prefix}-date`,
      label: withFormItem ? '日期' : undefined,
      props: { 'placeholder': `${prefix} 日期`, 'teleported': false, 'type': 'date', 'valueFormat': 'YYYY-MM-DD', 'data-testid': `${prefix}-date` },
      span: 12,
      visible,
    }),
    defineField({
      component: ElTimePicker,
      field: 'time' as ElementFieldKey<TValues>,
      id: `${prefix}-time`,
      label: withFormItem ? '时间' : undefined,
      props: { 'placeholder': `${prefix} 时间`, 'teleported': false, 'valueFormat': 'HH:mm:ss', 'data-testid': `${prefix}-time` },
      span: 12,
      visible,
    }),
    defineField({
      component: ElTimeSelect,
      field: 'timeSelect' as ElementFieldKey<TValues>,
      id: `${prefix}-time-select`,
      label: withFormItem ? '时间选择' : undefined,
      props: { 'end': '12:00', 'placeholder': `${prefix} 时间选择`, 'start': '09:00', 'step': '00:30', 'teleported': false, 'data-testid': `${prefix}-time-select` },
      span: 12,
      visible,
    }),
  ]
}

export const elementContainerFields: ConfigFormNode<ElementKnownValues>[] = [
  defineCommonField({
    cellAttrs: {},
    component: ElCard,
    id: 'element-container-card',
    span: 24,
    props: { 'bodyClass': 'config-form-demo__container', 'class': 'config-form-demo__container-card', 'data-testid': 'element-container-node', 'header': 'Element Card 容器', 'shadow': 'never' },
    slots: { default: createElementKnownFields('element-container', false, defineCommonField) },
  }),
  defineCommonField({
    cellAttrs: {},
    component: ElCollapse,
    id: 'element-container-collapse',
    span: 24,
    props: { 'class': 'config-form-demo__container-collapse', 'data-testid': 'element-container-collapse-node', 'modelValue': ['profile'] },
    slots: {
      default: defineCommonField({
        cellAttrs: {},
        component: ElCollapseItem,
        id: 'element-container-collapse-item',
        props: { name: 'profile', title: 'Element Collapse 容器' },
        slots: {
          default: defineCommonField({
            cellAttrs: {},
            component: 'p',
            id: 'element-container-collapse-content',
            props: { textContent: 'Collapse 容器承载非字段配置节点' },
          }),
        },
      }),
    },
  }),
  defineCommonField({
    cellAttrs: {},
    component: ElTabs,
    id: 'element-container-tabs',
    span: 24,
    props: { 'class': 'config-form-demo__container-tabs', 'data-testid': 'element-container-tabs-node', 'modelValue': 'base' },
    slots: {
      default: [
        defineCommonField({
          cellAttrs: {},
          component: ElTabPane,
          id: 'element-container-tab-base',
          props: { label: '基础', name: 'base' },
          slots: { default: defineCommonField({ cellAttrs: {}, component: 'p', id: 'element-container-tab-base-content', props: { textContent: 'Tabs 基础容器内容' } }) },
        }),
        defineCommonField({
          cellAttrs: {},
          component: ElTabPane,
          id: 'element-container-tab-preference',
          props: { label: '偏好', name: 'preference' },
          slots: { default: defineCommonField({ cellAttrs: {}, component: 'p', id: 'element-container-tab-preference-content', props: { textContent: 'Tabs 偏好容器内容' } }) },
        }),
      ],
    },
  }),
]

export const elementLinkedFields: ConfigFormNode<ElementLinkedValues>[] = [
  defineLinkedField({
    component: ElSwitch,
    field: 'advanced',
    id: 'element-linked-advanced',
    label: '高级模式',
    props: { 'activeText': '启用', 'inactiveText': '关闭', 'data-testid': 'element-linked-advanced-switch' },
    span: 12,
  }),
  ...createElementKnownFields('element-linked', true, defineLinkedField, values => values.advanced),
  defineLinkedField({
    component: ElRadioGroup,
    field: 'planType',
    id: 'element-linked-plan-type',
    label: '方案类型',
    props: { 'data-testid': 'element-linked-plan-radio' },
    slots: {
      default: createRadioOptions().map(option => defineLinkedField({
        cellAttrs: {},
        component: ElRadio,
        id: `element-linked-plan-option-${String(option.value)}`,
        props: option,
      })),
    },
    span: 12,
  }),
  defineLinkedField({
    component: ElInput,
    field: 'enterpriseName',
    id: 'element-linked-enterprise-name',
    label: '企业名称',
    props: { 'placeholder': '企业模式显示', 'data-testid': 'element-linked-enterprise-name' },
    readonly: values => values.marketing,
    readonlyRender: ({ value }) => h('span', { 'data-testid': 'element-linked-enterprise-name-readonly' }, `已锁定：${String(value || '未填写')}`),
    required: true,
    requiredMessage: '请输入企业名称',
    schema: z.string().trim().min(2, '企业名称至少 2 个字符'),
    span: 12,
    validateOn: 'blur',
    visible: values => values.planType === 'enterprise',
  }),
  defineLinkedField({
    component: ElCheckbox,
    field: 'marketing',
    id: 'element-linked-marketing',
    label: '营销设置',
    props: { 'label': '启用营销备注', 'data-testid': 'element-linked-marketing-checkbox' },
    span: 12,
  }),
  defineLinkedField({
    component: ElInput,
    field: 'marketingNote',
    id: 'element-linked-marketing-note',
    label: '营销备注',
    props: { 'placeholder': '勾选后显示', 'rows': 2, 'type': 'textarea', 'data-testid': 'element-linked-marketing-note' },
    span: 12,
    visible: values => values.marketing,
  }),
  defineLinkedField({
    component: ElSelect,
    field: 'notifyChannel',
    id: 'element-linked-notify-channel',
    label: '通知方式',
    props: { 'placeholder': '选择通知方式', 'teleported': false, 'data-testid': 'element-linked-notify-channel' },
    slots: {
      default: createNotifyOptions().map(option => defineLinkedField({
        cellAttrs: {},
        component: ElOption,
        id: `element-linked-notify-option-${String(option.value)}`,
        props: option,
      })),
    },
    span: 12,
  }),
  defineLinkedField({
    component: ElTimeSelect,
    field: 'scheduledTime',
    id: 'element-linked-scheduled-time',
    label: '预约时间',
    props: { 'end': '12:00', 'placeholder': '预约通知显示', 'start': '09:00', 'step': '00:30', 'teleported': false, 'data-testid': 'element-linked-scheduled-time' },
    span: 12,
    visible: values => values.notifyChannel === 'scheduled',
  }),
  defineLinkedField({
    component: ElInputNumber,
    field: 'seatCount',
    id: 'element-linked-seat-count',
    label: '席位数',
    props: { 'max': 99, 'min': 1, 'data-testid': 'element-linked-seat-count' },
    span: 12,
  }),
  defineLinkedField({
    component: ElInput,
    field: 'seatNote',
    id: 'element-linked-seat-note',
    label: '席位说明',
    props: { 'placeholder': '席位数达到 5 后显示', 'rows': 2, 'type': 'textarea', 'data-testid': 'element-linked-seat-note' },
    span: 12,
    visible: values => values.seatCount >= 5,
  }),
]

function createFlatOptions(suffix: string): ElementOption[] {
  return [
    { label: `${suffix} 草稿`, value: `${suffix}-draft` },
    { label: `${suffix} 启用`, value: `${suffix}-enabled` },
  ]
}

function createSelectV2Options(suffix: string): ElementOption[] {
  return [
    { label: `${suffix} 小型`, value: `${suffix}-small` },
    { label: `${suffix} 大型`, value: `${suffix}-large` },
  ]
}

function createNestedOptions(suffix: string): ElementOption[] {
  return [{
    label: `${suffix} 华东`,
    value: `${suffix}-east`,
    children: [
      { label: `${suffix} 杭州`, value: `${suffix}-hangzhou` },
      { label: `${suffix} 上海`, value: `${suffix}-shanghai` },
    ],
  }]
}

function createTreeOptions(suffix: string): ElementOption[] {
  return [{
    label: `${suffix} 根节点`,
    value: `${suffix}-root-a`,
    children: [{ label: `${suffix} 叶子节点`, value: `${suffix}-leaf-a` }],
  }]
}

function createCheckOptions(suffix: string): ElementOption[] {
  return [
    { label: `${suffix} 邮件`, value: 'mail' },
    { label: `${suffix} 短信`, value: 'sms' },
  ]
}

function createRadioOptions(): ElementOption[] {
  return [
    { label: '标准', value: 'standard' },
    { label: '企业', value: 'enterprise' },
  ]
}

function createNotifyOptions(): ElementOption[] {
  return [
    { label: '立即通知', value: 'immediate' },
    { label: '预约通知', value: 'scheduled' },
  ]
}
