import type { ConfigFormNode } from '@moluoxixi/config-form-headless'
import type { ElementLinkedValues } from '../types'
import { defineFields } from '@moluoxixi/config-form-headless'
import {
  ElCheckbox,
  ElInput,
  ElInputNumber,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect,
  ElSwitch,
  ElTimeSelect,
} from 'element-plus'
import { h } from 'vue'
import { z } from 'zod'
import { createElementKnownFields, createElementKnownValues } from './known-fields'
import { createNotifyOptions, createRadioOptions } from './options'

const { defineField } = defineFields<ElementLinkedValues>()

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

export const elementLinkedFields: ConfigFormNode<ElementLinkedValues>[] = [
  defineField({
    component: ElSwitch,
    field: 'advanced',
    id: 'element-linked-advanced',
    label: '高级模式',
    props: { 'activeText': '启用', 'inactiveText': '关闭', 'data-testid': 'element-linked-advanced-switch' },
    span: 12,
  }),
  ...createElementKnownFields('element-linked', true, defineField, values => values.advanced),
  defineField({
    component: ElRadioGroup,
    field: 'planType',
    id: 'element-linked-plan-type',
    label: '方案类型',
    props: { 'data-testid': 'element-linked-plan-radio' },
    slots: {
      default: createRadioOptions().map(option => defineField({
        cellAttrs: {},
        component: ElRadio,
        id: `element-linked-plan-option-${String(option.value)}`,
        props: option,
      })),
    },
    span: 12,
  }),
  defineField({
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
  defineField({
    component: ElCheckbox,
    field: 'marketing',
    id: 'element-linked-marketing',
    label: '营销设置',
    props: { 'label': '启用营销备注', 'data-testid': 'element-linked-marketing-checkbox' },
    span: 12,
  }),
  defineField({
    component: ElInput,
    field: 'marketingNote',
    id: 'element-linked-marketing-note',
    label: '营销备注',
    props: { 'placeholder': '勾选后显示', 'rows': 2, 'type': 'textarea', 'data-testid': 'element-linked-marketing-note' },
    span: 12,
    visible: values => values.marketing,
  }),
  defineField({
    component: ElSelect,
    field: 'notifyChannel',
    id: 'element-linked-notify-channel',
    label: '通知方式',
    props: { 'placeholder': '选择通知方式', 'teleported': false, 'data-testid': 'element-linked-notify-channel' },
    slots: {
      default: createNotifyOptions().map(option => defineField({
        cellAttrs: {},
        component: ElOption,
        id: `element-linked-notify-option-${String(option.value)}`,
        props: option,
      })),
    },
    span: 12,
  }),
  defineField({
    component: ElTimeSelect,
    field: 'scheduledTime',
    id: 'element-linked-scheduled-time',
    label: '预约时间',
    props: { 'end': '12:00', 'placeholder': '预约通知显示', 'start': '09:00', 'step': '00:30', 'teleported': false, 'data-testid': 'element-linked-scheduled-time' },
    span: 12,
    visible: values => values.notifyChannel === 'scheduled',
  }),
  defineField({
    component: ElInputNumber,
    field: 'seatCount',
    id: 'element-linked-seat-count',
    label: '席位数',
    props: { 'max': 99, 'min': 1, 'data-testid': 'element-linked-seat-count' },
    span: 12,
  }),
  defineField({
    component: ElInput,
    field: 'seatNote',
    id: 'element-linked-seat-note',
    label: '席位说明',
    props: { 'placeholder': '席位数达到 5 后显示', 'rows': 2, 'type': 'textarea', 'data-testid': 'element-linked-seat-note' },
    span: 12,
    visible: values => values.seatCount >= 5,
  }),
]
