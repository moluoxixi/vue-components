<script lang="ts">
// 示例元信息由 playground 通过 import.meta.glob 读取，用于生成侧栏和页面标题。
export const exampleMeta = {
  name: 'antdConfigForm',
  title: 'antdConfigForm',
  category: '配置表单',
  description: 'Ant Design Vue 轻量配置表单包的布局、容器和联动场景。',
  hidden: true,
  order: 50,
}
</script>

<script setup lang="ts">
import type {
  ConfigFormCondition,
  ConfigFormValues,
  DefineConfigFormFieldFactory,
} from '@moluoxixi/config-form-core'
import { defineFields } from '@moluoxixi/config-form-core'
import { antdConfigForm } from '@moluoxixi/config-form-antd-vue'
import {
  AutoComplete as AAutoComplete,
  Button as AButton,
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
import { computed, shallowRef } from 'vue'

type ScenarioTab = 'layout' | 'container' | 'linked'

interface AntdOption {
  label: string
  value: string
  children?: AntdOption[]
}

interface AntdTreeOption {
  title: string
  value: string
  children?: AntdTreeOption[]
}

interface AntdKnownValues {
  autoComplete: string
  cascader: string[]
  checkbox: boolean
  checkboxGroup: string[]
  date: string
  input: string
  inputNumber: number
  password: string
  radio: string
  range: string[]
  rate: number
  search: string
  select: string
  slider: number
  switchValue: boolean
  textarea: string
  time: string
  timeRange: string[]
  treeSelect: string
}

interface AntdLinkedValues extends AntdKnownValues {
  advanced: boolean
  enterpriseName: string
  marketing: boolean
  marketingNote: string
  notifyChannel: string
  planType: string
  scheduledTime: string
  seatCount: number
  seatNote: string
}

type AntdFieldKey<TValues extends AntdKnownValues> = Extract<keyof TValues, string>

const ATextarea = AInput.TextArea
const AInputPassword = AInput.Password
const AInputSearch = AInput.Search
const ACheckboxGroup = ACheckbox.Group
const ARadioGroup = ARadio.Group
const ARangePicker = ADatePicker.RangePicker
const { defineField: defineCommonField } = defineFields<AntdKnownValues>()
const { defineField: defineLinkedField } = defineFields<AntdLinkedValues>()

const activeTab = shallowRef<ScenarioTab>('layout')
const layoutGridMode = shallowRef(false)
const layoutModeLabel = computed(() => layoutGridMode.value ? 'grid' : 'inline')

const layoutInlineModel = shallowRef<AntdKnownValues>(createKnownValues('inline'))
const layoutGridModel = shallowRef<AntdKnownValues>(createKnownValues('grid'))
const containerModel = shallowRef<AntdKnownValues>(createKnownValues('container'))
const linkedModel = shallowRef<AntdLinkedValues>({
  ...createKnownValues('linked'),
  advanced: false,
  enterpriseName: '',
  marketing: false,
  marketingNote: '',
  notifyChannel: 'immediate',
  planType: 'standard',
  scheduledTime: '10:00:00',
  seatCount: 1,
  seatNote: '',
})

const layoutInlineSubmitted = shallowRef<Partial<AntdKnownValues>>({})
const layoutGridSubmitted = shallowRef<Partial<AntdKnownValues>>({})
const containerSubmitted = shallowRef<Partial<AntdKnownValues>>({})
const linkedSubmitted = shallowRef<Partial<AntdLinkedValues>>({})

// Antd 版本的字段矩阵显式覆盖 value 与 checked 两类写回协议。
const layoutInlineFields = createKnownFields('antd-inline', true, defineCommonField)
const layoutGridFields = createKnownFields('antd-grid', true, defineCommonField)
const containerFields = [
  defineCommonField({
    colProps: {},
    component: ACard,
    span: 24,
    props: {
      class: 'config-form-demo__container-card',
      'data-testid': 'antd-container-node',
      size: 'small',
      title: 'Antd Card 容器',
    },
    slots: {
      default: createKnownFields('antd-container', false, defineCommonField),
    },
  }),
  defineCommonField({
    colProps: {},
    component: ACollapse,
    span: 24,
    props: {
      class: 'config-form-demo__container-collapse',
      defaultActiveKey: ['profile'],
      'data-testid': 'antd-container-collapse-node',
    },
    slots: {
      default: defineCommonField({
        colProps: {},
        component: ACollapsePanel,
        props: {
          header: 'Antd Collapse 容器',
          key: 'profile',
        },
        slots: {
          default: createKnownFields('antd-container-collapse', false, defineCommonField).slice(0, 4),
        },
      }),
    },
  }),
  defineCommonField({
    colProps: {},
    component: ATabs,
    span: 24,
    props: {
      activeKey: 'base',
      class: 'config-form-demo__container-tabs',
      'data-testid': 'antd-container-tabs-node',
    },
    slots: {
      default: [
        defineCommonField({
          colProps: {},
          component: ATabPane,
          props: {
            key: 'base',
            tab: '基础',
          },
          slots: {
            default: createKnownFields('antd-container-tabs-base', false, defineCommonField).slice(0, 3),
          },
        }),
        defineCommonField({
          colProps: {},
          component: ATabPane,
          props: {
            key: 'preference',
            tab: '偏好',
          },
          slots: {
            default: createKnownFields('antd-container-tabs-preference', false, defineCommonField).slice(4, 7),
          },
        }),
      ],
    },
  }),
]
const linkedFields = [
  defineLinkedField({
    component: ASwitch,
    field: 'advanced',
    label: '高级模式',
    props: {
      checkedChildren: '启用',
      unCheckedChildren: '关闭',
      'data-testid': 'antd-linked-advanced-switch',
    },
    span: 12,
    trigger: 'update:checked',
    valueProp: 'checked',
  }),
  ...createKnownFields('antd-linked', true, defineLinkedField, values => values.advanced),
  ...createLinkedControlFields(),
]

const layoutSubmittedText = computed(() => JSON.stringify({
  grid: layoutGridSubmitted.value,
  inline: layoutInlineSubmitted.value,
}, null, 2))
const containerSubmittedText = computed(() => JSON.stringify(containerSubmitted.value, null, 2))
const linkedSubmittedText = computed(() => JSON.stringify(linkedSubmitted.value, null, 2))

function createKnownValues(seed: string): AntdKnownValues {
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

function createKnownFields<TValues extends AntdKnownValues>(
  prefix: string,
  withFormItem: boolean,
  defineField: DefineConfigFormFieldFactory<TValues>,
  visible?: ConfigFormCondition<TValues>,
) {
  const suffix = prefix.replace('antd-', '')

  return [
    defineField({
      component: AInput,
      field: 'input' as AntdFieldKey<TValues>,
      label: withFormItem ? '文本输入' : undefined,
      props: {
        placeholder: `${prefix} 文本输入`,
        'data-testid': `${prefix}-input`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ATextarea,
      field: 'textarea' as AntdFieldKey<TValues>,
      label: withFormItem ? '多行文本' : undefined,
      props: {
        placeholder: `${prefix} 多行文本`,
        rows: 2,
        'data-testid': `${prefix}-textarea`,
      },
      span: 24,
      visible,
    }),
    defineField({
      component: AInputPassword,
      field: 'password' as AntdFieldKey<TValues>,
      label: withFormItem ? '密码输入' : undefined,
      props: {
        placeholder: `${prefix} 密码输入`,
        'data-testid': `${prefix}-password`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: AInputSearch,
      field: 'search' as AntdFieldKey<TValues>,
      label: withFormItem ? '搜索输入' : undefined,
      props: {
        placeholder: `${prefix} 搜索输入`,
        'data-testid': `${prefix}-search`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: AInputNumber,
      field: 'inputNumber' as AntdFieldKey<TValues>,
      label: withFormItem ? '数字输入' : undefined,
      props: {
        max: 99,
        min: 0,
        'data-testid': `${prefix}-input-number`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: AAutoComplete,
      field: 'autoComplete' as AntdFieldKey<TValues>,
      label: withFormItem ? '自动完成' : undefined,
      props: {
        options: createFlatOptions(suffix),
        placeholder: `${prefix} 自动完成`,
        'data-testid': `${prefix}-auto-complete`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ASelect,
      field: 'select' as AntdFieldKey<TValues>,
      label: withFormItem ? '下拉选择' : undefined,
      props: {
        options: createFlatOptions(suffix),
        placeholder: `${prefix} 下拉选择`,
        'data-testid': `${prefix}-select`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ACascader,
      field: 'cascader' as AntdFieldKey<TValues>,
      label: withFormItem ? '级联选择' : undefined,
      props: {
        options: createNestedOptions(suffix),
        placeholder: `${prefix} 级联选择`,
        'data-testid': `${prefix}-cascader`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ATreeSelect,
      field: 'treeSelect' as AntdFieldKey<TValues>,
      label: withFormItem ? '树形选择' : undefined,
      props: {
        placeholder: `${prefix} 树形选择`,
        treeData: createTreeOptions(suffix),
        'data-testid': `${prefix}-tree-select`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ACheckbox,
      field: 'checkbox' as AntdFieldKey<TValues>,
      label: withFormItem ? '单选勾选' : undefined,
      props: {
        'data-testid': `${prefix}-checkbox`,
      },
      slots: {
        default: () => `${suffix} 开启`,
      },
      span: 12,
      trigger: 'update:checked',
      valueProp: 'checked',
      visible,
    }),
    defineField({
      component: ACheckboxGroup,
      field: 'checkboxGroup' as AntdFieldKey<TValues>,
      label: withFormItem ? '多选勾选' : undefined,
      props: {
        options: createCheckOptions(suffix),
        'data-testid': `${prefix}-checkbox-group`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ASwitch,
      field: 'switchValue' as AntdFieldKey<TValues>,
      label: withFormItem ? '开关' : undefined,
      props: {
        checkedChildren: '开启',
        unCheckedChildren: '关闭',
        'data-testid': `${prefix}-switch`,
      },
      span: 12,
      trigger: 'update:checked',
      valueProp: 'checked',
      visible,
    }),
    defineField({
      component: ARadioGroup,
      field: 'radio' as AntdFieldKey<TValues>,
      label: withFormItem ? '单选组' : undefined,
      props: {
        options: createRadioOptions(),
        'data-testid': `${prefix}-radio`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ARate,
      field: 'rate' as AntdFieldKey<TValues>,
      label: withFormItem ? '评分' : undefined,
      props: {
        'data-testid': `${prefix}-rate`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ASlider,
      field: 'slider' as AntdFieldKey<TValues>,
      label: withFormItem ? '滑块' : undefined,
      props: {
        max: 100,
        min: 0,
        'data-testid': `${prefix}-slider`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ADatePicker,
      field: 'date' as AntdFieldKey<TValues>,
      label: withFormItem ? '日期' : undefined,
      props: {
        placeholder: `${prefix} 日期`,
        valueFormat: 'YYYY-MM-DD',
        'data-testid': `${prefix}-date`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ARangePicker,
      field: 'range' as AntdFieldKey<TValues>,
      label: withFormItem ? '日期范围' : undefined,
      props: {
        valueFormat: 'YYYY-MM-DD',
        'data-testid': `${prefix}-range`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ATimePicker,
      field: 'time' as AntdFieldKey<TValues>,
      label: withFormItem ? '时间' : undefined,
      props: {
        valueFormat: 'HH:mm:ss',
        'data-testid': `${prefix}-time`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ATimeRangePicker,
      field: 'timeRange' as AntdFieldKey<TValues>,
      label: withFormItem ? '时间范围' : undefined,
      props: {
        valueFormat: 'HH:mm:ss',
        'data-testid': `${prefix}-time-range`,
      },
      span: 12,
      visible,
    }),
  ]
}

function createLinkedControlFields() {
  return [
    defineLinkedField({
      component: ARadioGroup,
      field: 'planType',
      label: '方案类型',
      props: {
        options: createRadioOptions(),
        'data-testid': 'antd-linked-plan-radio',
      },
      span: 12,
    }),
    defineLinkedField({
      component: AInput,
      field: 'enterpriseName',
      label: '企业名称',
      props: {
        placeholder: '企业模式显示',
        'data-testid': 'antd-linked-enterprise-name',
      },
      span: 12,
      visible: values => values.planType === 'enterprise',
    }),
    defineLinkedField({
      component: ACheckbox,
      field: 'marketing',
      label: '营销设置',
      props: {
        'data-testid': 'antd-linked-marketing-checkbox',
      },
      slots: {
        default: () => '启用营销备注',
      },
      span: 12,
      trigger: 'update:checked',
      valueProp: 'checked',
    }),
    defineLinkedField({
      component: ATextarea,
      field: 'marketingNote',
      label: '营销备注',
      props: {
        placeholder: '勾选后显示',
        rows: 2,
        'data-testid': 'antd-linked-marketing-note',
      },
      span: 12,
      visible: values => values.marketing,
    }),
    defineLinkedField({
      component: ASelect,
      field: 'notifyChannel',
      label: '通知方式',
      props: {
        options: createNotifyOptions(),
        placeholder: '选择通知方式',
        'data-testid': 'antd-linked-notify-channel',
      },
      span: 12,
    }),
    defineLinkedField({
      component: ATimePicker,
      field: 'scheduledTime',
      label: '预约时间',
      props: {
        valueFormat: 'HH:mm:ss',
        'data-testid': 'antd-linked-scheduled-time',
      },
      span: 12,
      visible: values => values.notifyChannel === 'scheduled',
    }),
    defineLinkedField({
      component: AInputNumber,
      field: 'seatCount',
      label: '席位数',
      props: {
        max: 99,
        min: 1,
        'data-testid': 'antd-linked-seat-count',
      },
      span: 12,
    }),
    defineLinkedField({
      component: ATextarea,
      field: 'seatNote',
      label: '席位说明',
      props: {
        placeholder: '席位数达到 5 后显示',
        rows: 2,
        'data-testid': 'antd-linked-seat-note',
      },
      span: 12,
      visible: values => values.seatCount >= 5,
    }),
  ]
}

function createFlatOptions(suffix: string): AntdOption[] {
  return [
    { label: `${suffix} 草稿`, value: `${suffix}-draft` },
    { label: `${suffix} 启用`, value: `${suffix}-enabled` },
  ]
}

function createNestedOptions(suffix: string): AntdOption[] {
  return [
    {
      label: `${suffix} 华东`,
      value: `${suffix}-east`,
      children: [
        { label: `${suffix} 杭州`, value: `${suffix}-hangzhou` },
        { label: `${suffix} 上海`, value: `${suffix}-shanghai` },
      ],
    },
  ]
}

function createTreeOptions(suffix: string): AntdTreeOption[] {
  return [
    {
      title: `${suffix} 根节点`,
      value: `${suffix}-root-a`,
      children: [
        { title: `${suffix} 叶子节点`, value: `${suffix}-leaf-a` },
      ],
    },
  ]
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

function submitLayoutInline(values: ConfigFormValues): void {
  layoutInlineSubmitted.value = values as AntdKnownValues
}

function submitLayoutGrid(values: ConfigFormValues): void {
  layoutGridSubmitted.value = values as AntdKnownValues
}

function submitContainer(values: ConfigFormValues): void {
  containerSubmitted.value = values as AntdKnownValues
}

function submitLinked(values: ConfigFormValues): void {
  linkedSubmitted.value = values as AntdLinkedValues
}
</script>

<template>
  <div class="config-form-demo" data-testid="antd-config-form-example">
    <ATabs v-model:active-key="activeTab" data-testid="antd-scenario-tabs">
      <ATabPane key="layout" tab="布局">
        <section class="config-form-demo__section" data-testid="antd-layout-scenario">
          <div class="config-form-demo__toolbar">
            <span class="config-form-demo__mode" data-testid="antd-layout-mode-label">{{ layoutModeLabel }}</span>
            <ASwitch
              v-model:checked="layoutGridMode"
              checked-children="grid"
              data-testid="antd-layout-mode-switch"
              un-checked-children="inline"
            />
          </div>

          <antdConfigForm
            v-if="!layoutGridMode"
            v-model="layoutInlineModel"
            data-testid="antd-layout-inline"
            :field-span="12"
            :fields="layoutInlineFields"
            :form-props="{ layout: 'inline', labelCol: { style: { width: '96px' } }, wrapperCol: { flex: 1 } }"
            :row-props="{ gutter: 16, 'data-testid': 'antd-layout-inline-row' }"
            @submit="submitLayoutInline"
          >
            <template #default="{ submit }">
              <div class="config-form-demo__actions">
                <AButton type="primary" data-testid="antd-layout-inline-submit" @click="submit">
                  提交 inline
                </AButton>
              </div>
            </template>
          </antdConfigForm>

          <antdConfigForm
            v-else
            v-model="layoutGridModel"
            data-testid="antd-layout-grid-form"
            :field-span="12"
            :fields="layoutGridFields"
            :form-props="{ labelCol: { style: { width: '96px' } }, wrapperCol: { flex: 1 } }"
            :row-props="{ gutter: 16, 'data-testid': 'antd-layout-grid' }"
            @submit="submitLayoutGrid"
          >
            <template #default="{ submit }">
              <div class="config-form-demo__actions">
                <AButton type="primary" data-testid="antd-layout-grid-submit" @click="submit">
                  提交 grid
                </AButton>
              </div>
            </template>
          </antdConfigForm>

          <pre class="config-form-demo__preview" data-testid="antd-layout-preview">{{ layoutSubmittedText }}</pre>
        </section>
      </ATabPane>

      <ATabPane key="container" tab="容器">
        <section class="config-form-demo__section" data-testid="antd-container-scenario">
          <antdConfigForm
            v-model="containerModel"
            data-testid="antd-container-form"
            :fields="containerFields"
            :form-props="{ labelCol: { style: { width: '96px' } }, wrapperCol: { flex: 1 } }"
            :row-props="{ gutter: 16, 'data-testid': 'antd-container-row' }"
            @submit="submitContainer"
          >
            <template #default="{ submit }">
              <div class="config-form-demo__actions config-form-demo__actions--plain">
                <AButton type="primary" data-testid="antd-container-submit" @click="submit">
                  提交容器
                </AButton>
              </div>
            </template>
          </antdConfigForm>

          <pre class="config-form-demo__preview" data-testid="antd-container-preview">{{ containerSubmittedText }}</pre>
        </section>
      </ATabPane>

      <ATabPane key="linked" tab="联动">
        <section class="config-form-demo__section" data-testid="antd-linked-scenario">
          <antdConfigForm
            v-model="linkedModel"
            data-testid="antd-linked-form"
            :field-span="12"
            :fields="linkedFields"
            :form-props="{ labelCol: { style: { width: '96px' } }, wrapperCol: { flex: 1 } }"
            :row-props="{ gutter: 16, 'data-testid': 'antd-linked-row' }"
            @submit="submitLinked"
          >
            <template #default="{ submit }">
              <div class="config-form-demo__actions">
                <AButton type="primary" data-testid="antd-linked-submit" @click="submit">
                  提交联动
                </AButton>
              </div>
            </template>
          </antdConfigForm>

          <pre class="config-form-demo__preview" data-testid="antd-linked-preview">{{ linkedSubmittedText }}</pre>
        </section>
      </ATabPane>
    </ATabs>
  </div>
</template>

<style scoped lang="scss">
.config-form-demo {
  max-width: 1080px;
}

.config-form-demo__section {
  padding-top: 8px;
}

.config-form-demo__toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.config-form-demo__mode {
  min-width: 48px;
  color: rgb(0 0 0 / 65%);
  font-size: 13px;
  line-height: 1.4;
}

:deep([data-testid="antd-layout-inline-row"]) {
  row-gap: 16px;
}

/* ConfigForm render 函数创建的容器节点没有当前 SFC 的 scoped attribute，需要整体穿透动态节点选择器。 */
:deep(.config-form-demo__container-card),
:deep(.config-form-demo__container-collapse),
:deep(.config-form-demo__container-tabs) {
  width: 100%;
}

:deep(.config-form-demo__container-collapse),
:deep(.config-form-demo__container-tabs) {
  margin-top: 16px;
}

:deep(.config-form-demo__container-card .ant-card-body),
:deep(.config-form-demo__container-collapse .ant-collapse-content-box),
:deep(.config-form-demo__container-tabs .ant-tabs-tabpane-active) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  width: 100%;
}

:deep(.config-form-demo__container-card .ant-card-body::before),
:deep(.config-form-demo__container-card .ant-card-body::after),
:deep(.config-form-demo__container-collapse .ant-collapse-content-box::before),
:deep(.config-form-demo__container-collapse .ant-collapse-content-box::after),
:deep(.config-form-demo__container-tabs .ant-tabs-tabpane-active::before),
:deep(.config-form-demo__container-tabs .ant-tabs-tabpane-active::after) {
  display: none;
  content: none;
}

:deep(.config-form-demo__container-card .ant-input),
:deep(.config-form-demo__container-card .ant-input-number),
:deep(.config-form-demo__container-card .ant-select),
:deep(.config-form-demo__container-card .ant-picker),
:deep(.config-form-demo__container-card .ant-slider),
:deep(.config-form-demo__container-card .ant-rate),
:deep(.config-form-demo__container-collapse .ant-input),
:deep(.config-form-demo__container-collapse .ant-input-number),
:deep(.config-form-demo__container-collapse .ant-select),
:deep(.config-form-demo__container-collapse .ant-picker),
:deep(.config-form-demo__container-collapse .ant-slider),
:deep(.config-form-demo__container-collapse .ant-rate),
:deep(.config-form-demo__container-tabs .ant-input),
:deep(.config-form-demo__container-tabs .ant-input-number),
:deep(.config-form-demo__container-tabs .ant-select),
:deep(.config-form-demo__container-tabs .ant-picker),
:deep(.config-form-demo__container-tabs .ant-slider),
:deep(.config-form-demo__container-tabs .ant-rate) {
  width: 100%;
}

:deep(.config-form-demo__container-card textarea.ant-input),
:deep(.config-form-demo__container-collapse textarea.ant-input),
:deep(.config-form-demo__container-tabs textarea.ant-input) {
  grid-column: 1 / -1;
}

.config-form-demo__actions {
  display: flex;
  gap: 10px;
  margin: 4px 0 18px 96px;
}

.config-form-demo__actions--plain {
  margin-left: 0;
}

.config-form-demo__preview {
  min-height: 96px;
  margin: 0;
  padding: 14px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fafafa;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
