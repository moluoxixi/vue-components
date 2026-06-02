<script lang="ts">
// 示例元信息由 playground 通过 import.meta.glob 读取，用于生成侧栏和页面标题。
export const exampleMeta = {
  name: 'ElementConfigForm',
  title: 'ElementConfigForm',
  category: '配置表单',
  description: 'Element Plus 轻量配置表单包的布局、容器和联动场景。',
  hidden: true,
  order: 40,
}
</script>

<script setup lang="ts">
import type {
  ConfigFormCondition,
  ConfigFormValues,
  DefineConfigFormFieldFactory,
} from '@moluoxixi/config-form-core'
import { defineFields } from '@moluoxixi/config-form-core'
import { ElementConfigForm } from '@moluoxixi/config-form-element'
import {
  ElAutocomplete,
  ElButton,
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
import { computed, shallowRef } from 'vue'

type ScenarioTab = 'layout' | 'container' | 'linked'
type LayoutMode = 'inline' | 'grid'

interface ElementOption extends Record<string, unknown> {
  label: string
  value: string
  children?: ElementOption[]
}

interface ElementKnownValues {
  autocomplete: string
  cascader: string
  checkbox: boolean
  checkboxGroup: string[]
  color: string
  date: string
  input: string
  inputNumber: number
  radio: string
  rate: number
  select: string
  selectV2: string
  slider: number
  switchValue: boolean
  textarea: string
  time: string
  timeSelect: string
  treeSelect: string
}

interface ElementLinkedValues extends ElementKnownValues {
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

type ElementFieldKey<TValues extends ElementKnownValues> = Extract<keyof TValues, string>

const { defineField: defineCommonField } = defineFields<ElementKnownValues>()
const { defineField: defineLinkedField } = defineFields<ElementLinkedValues>()

const activeTab = shallowRef<ScenarioTab>('layout')
const layoutMode = shallowRef<LayoutMode>('inline')
const layoutModeLabel = computed(() => layoutMode.value)

const layoutInlineModel = shallowRef<ElementKnownValues>(createKnownValues('inline'))
const layoutGridModel = shallowRef<ElementKnownValues>(createKnownValues('grid'))
const containerModel = shallowRef<ElementKnownValues>(createKnownValues('container'))
const linkedModel = shallowRef<ElementLinkedValues>({
  ...createKnownValues('linked'),
  advanced: false,
  enterpriseName: '',
  marketing: false,
  marketingNote: '',
  notifyChannel: 'immediate',
  planType: 'standard',
  scheduledTime: '10:00',
  seatCount: 1,
  seatNote: '',
})

const layoutInlineSubmitted = shallowRef<Partial<ElementKnownValues>>({})
const layoutGridSubmitted = shallowRef<Partial<ElementKnownValues>>({})
const containerSubmitted = shallowRef<Partial<ElementKnownValues>>({})
const linkedSubmitted = shallowRef<Partial<ElementLinkedValues>>({})

// 每个场景都复用同一批字段，确保 playground 和 e2e 覆盖同一份 Element Plus 已知组件矩阵。
const layoutInlineFields = createKnownFields('element-inline', true, defineCommonField)
const layoutGridFields = createKnownFields('element-grid', true, defineCommonField)
const containerFields = [
  defineCommonField({
    colProps: {},
    component: ElCard,
    span: 24,
    props: {
      bodyClass: 'config-form-demo__container',
      class: 'config-form-demo__container-card',
      'data-testid': 'element-container-node',
      header: 'Element Card 容器',
      shadow: 'never',
    },
    slots: {
      default: createKnownFields('element-container', false, defineCommonField),
    },
  }),
  defineCommonField({
    colProps: {},
    component: ElCollapse,
    span: 24,
    props: {
      class: 'config-form-demo__container-collapse',
      'data-testid': 'element-container-collapse-node',
      modelValue: ['profile'],
    },
    slots: {
      default: defineCommonField({
        colProps: {},
        component: ElCollapseItem,
        props: {
          name: 'profile',
          title: 'Element Collapse 容器',
        },
        slots: {
          default: createKnownFields('element-container-collapse', false, defineCommonField).slice(0, 4),
        },
      }),
    },
  }),
  defineCommonField({
    colProps: {},
    component: ElTabs,
    span: 24,
    props: {
      class: 'config-form-demo__container-tabs',
      'data-testid': 'element-container-tabs-node',
      modelValue: 'base',
    },
    slots: {
      default: [
        defineCommonField({
          colProps: {},
          component: ElTabPane,
          props: {
            label: '基础',
            name: 'base',
          },
          slots: {
            default: createKnownFields('element-container-tabs-base', false, defineCommonField).slice(0, 3),
          },
        }),
        defineCommonField({
          colProps: {},
          component: ElTabPane,
          props: {
            label: '偏好',
            name: 'preference',
          },
          slots: {
            default: createKnownFields('element-container-tabs-preference', false, defineCommonField).slice(4, 7),
          },
        }),
      ],
    },
  }),
]
const linkedFields = [
  defineLinkedField({
    component: ElSwitch,
    field: 'advanced',
    label: '高级模式',
    props: {
      activeText: '启用',
      inactiveText: '关闭',
      'data-testid': 'element-linked-advanced-switch',
    },
    span: 12,
  }),
  ...createKnownFields('element-linked', true, defineLinkedField, values => values.advanced),
  ...createLinkedControlFields(),
]

const layoutSubmittedText = computed(() => JSON.stringify({
  grid: layoutGridSubmitted.value,
  inline: layoutInlineSubmitted.value,
}, null, 2))
const containerSubmittedText = computed(() => JSON.stringify(containerSubmitted.value, null, 2))
const linkedSubmittedText = computed(() => JSON.stringify(linkedSubmitted.value, null, 2))

function createKnownValues(seed: string): ElementKnownValues {
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

function createKnownFields<TValues extends ElementKnownValues>(
  prefix: string,
  withFormItem: boolean,
  defineField: DefineConfigFormFieldFactory<TValues>,
  visible?: ConfigFormCondition<TValues>,
) {
  const suffix = prefix.replace('element-', '')

  return [
    defineField({
      component: ElInput,
      field: 'input' as ElementFieldKey<TValues>,
      label: withFormItem ? '文本输入' : undefined,
      props: {
        placeholder: `${prefix} 文本输入`,
        'data-testid': `${prefix}-input`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElInput,
      field: 'textarea' as ElementFieldKey<TValues>,
      label: withFormItem ? '多行文本' : undefined,
      props: {
        placeholder: `${prefix} 多行文本`,
        rows: 2,
        type: 'textarea',
        'data-testid': `${prefix}-textarea`,
      },
      span: 24,
      visible,
    }),
    defineField({
      component: ElInputNumber,
      field: 'inputNumber' as ElementFieldKey<TValues>,
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
      component: ElAutocomplete,
      field: 'autocomplete' as ElementFieldKey<TValues>,
      label: withFormItem ? '自动完成' : undefined,
      props: {
        fetchSuggestions: (_query: string, callback: (items: ElementOption[]) => void) => callback(createFlatOptions(suffix)),
        placeholder: `${prefix} 自动完成`,
        teleported: false,
        'data-testid': `${prefix}-autocomplete`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElSelect,
      field: 'select' as ElementFieldKey<TValues>,
      label: withFormItem ? '下拉选择' : undefined,
      props: {
        placeholder: `${prefix} 下拉选择`,
        teleported: false,
        'data-testid': `${prefix}-select`,
      },
      slots: {
        default: createFlatOptions(suffix).map(option =>
          defineField({
            colProps: {},
            component: ElOption,
            props: option,
          }),
        ),
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElSelectV2,
      field: 'selectV2' as ElementFieldKey<TValues>,
      label: withFormItem ? '虚拟选择' : undefined,
      props: {
        options: createSelectV2Options(suffix),
        placeholder: `${prefix} 虚拟选择`,
        teleported: false,
        'data-testid': `${prefix}-select-v2`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElCascader,
      field: 'cascader' as ElementFieldKey<TValues>,
      label: withFormItem ? '级联选择' : undefined,
      props: {
        options: createNestedOptions(suffix),
        placeholder: `${prefix} 级联选择`,
        props: { emitPath: false },
        teleported: false,
        'data-testid': `${prefix}-cascader`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElTreeSelect,
      field: 'treeSelect' as ElementFieldKey<TValues>,
      label: withFormItem ? '树形选择' : undefined,
      props: {
        data: createTreeOptions(suffix),
        placeholder: `${prefix} 树形选择`,
        renderAfterExpand: false,
        teleported: false,
        'data-testid': `${prefix}-tree-select`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElCheckbox,
      field: 'checkbox' as ElementFieldKey<TValues>,
      label: withFormItem ? '单选勾选' : undefined,
      props: {
        label: `${suffix} 开启`,
        'data-testid': `${prefix}-checkbox`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElCheckboxGroup,
      field: 'checkboxGroup' as ElementFieldKey<TValues>,
      label: withFormItem ? '多选勾选' : undefined,
      props: {
        'data-testid': `${prefix}-checkbox-group`,
      },
      slots: {
        default: createCheckOptions(suffix).map(option =>
          defineField({
            colProps: {},
            component: ElCheckbox,
            props: option,
          }),
        ),
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElSwitch,
      field: 'switchValue' as ElementFieldKey<TValues>,
      label: withFormItem ? '开关' : undefined,
      props: {
        activeText: '开启',
        inactiveText: '关闭',
        'data-testid': `${prefix}-switch`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElRadioGroup,
      field: 'radio' as ElementFieldKey<TValues>,
      label: withFormItem ? '单选组' : undefined,
      props: {
        'data-testid': `${prefix}-radio`,
      },
      slots: {
        default: createRadioOptions().map(option =>
          defineField({
            colProps: {},
            component: ElRadio,
            props: option,
          }),
        ),
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElRate,
      field: 'rate' as ElementFieldKey<TValues>,
      label: withFormItem ? '评分' : undefined,
      props: {
        'data-testid': `${prefix}-rate`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElSlider,
      field: 'slider' as ElementFieldKey<TValues>,
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
      component: ElColorPicker,
      field: 'color' as ElementFieldKey<TValues>,
      label: withFormItem ? '颜色' : undefined,
      props: {
        predefine: ['#409EFF', '#67C23A', '#E6A23C'],
        teleported: false,
        'data-testid': `${prefix}-color`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElDatePicker,
      field: 'date' as ElementFieldKey<TValues>,
      label: withFormItem ? '日期' : undefined,
      props: {
        placeholder: `${prefix} 日期`,
        teleported: false,
        type: 'date',
        valueFormat: 'YYYY-MM-DD',
        'data-testid': `${prefix}-date`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElTimePicker,
      field: 'time' as ElementFieldKey<TValues>,
      label: withFormItem ? '时间' : undefined,
      props: {
        placeholder: `${prefix} 时间`,
        teleported: false,
        valueFormat: 'HH:mm:ss',
        'data-testid': `${prefix}-time`,
      },
      span: 12,
      visible,
    }),
    defineField({
      component: ElTimeSelect,
      field: 'timeSelect' as ElementFieldKey<TValues>,
      label: withFormItem ? '时间选择' : undefined,
      props: {
        end: '12:00',
        placeholder: `${prefix} 时间选择`,
        start: '09:00',
        step: '00:30',
        teleported: false,
        'data-testid': `${prefix}-time-select`,
      },
      span: 12,
      visible,
    }),
  ]
}

function createLinkedControlFields() {
  return [
    defineLinkedField({
      component: ElRadioGroup,
      field: 'planType',
      label: '方案类型',
      props: {
        'data-testid': 'element-linked-plan-radio',
      },
      slots: {
        default: createRadioOptions().map(option =>
          defineLinkedField({
            colProps: {},
            component: ElRadio,
            props: option,
          }),
        ),
      },
      span: 12,
    }),
    defineLinkedField({
      component: ElInput,
      field: 'enterpriseName',
      label: '企业名称',
      props: {
        placeholder: '企业模式显示',
        'data-testid': 'element-linked-enterprise-name',
      },
      span: 12,
      visible: values => values.planType === 'enterprise',
    }),
    defineLinkedField({
      component: ElCheckbox,
      field: 'marketing',
      label: '营销设置',
      props: {
        label: '启用营销备注',
        'data-testid': 'element-linked-marketing-checkbox',
      },
      span: 12,
    }),
    defineLinkedField({
      component: ElInput,
      field: 'marketingNote',
      label: '营销备注',
      props: {
        placeholder: '勾选后显示',
        rows: 2,
        type: 'textarea',
        'data-testid': 'element-linked-marketing-note',
      },
      span: 12,
      visible: values => values.marketing,
    }),
    defineLinkedField({
      component: ElSelect,
      field: 'notifyChannel',
      label: '通知方式',
      props: {
        placeholder: '选择通知方式',
        teleported: false,
        'data-testid': 'element-linked-notify-channel',
      },
      slots: {
        default: createNotifyOptions().map(option =>
          defineLinkedField({
            colProps: {},
            component: ElOption,
            props: option,
          }),
        ),
      },
      span: 12,
    }),
    defineLinkedField({
      component: ElTimeSelect,
      field: 'scheduledTime',
      label: '预约时间',
      props: {
        end: '12:00',
        placeholder: '预约通知显示',
        start: '09:00',
        step: '00:30',
        teleported: false,
        'data-testid': 'element-linked-scheduled-time',
      },
      span: 12,
      visible: values => values.notifyChannel === 'scheduled',
    }),
    defineLinkedField({
      component: ElInputNumber,
      field: 'seatCount',
      label: '席位数',
      props: {
        max: 99,
        min: 1,
        'data-testid': 'element-linked-seat-count',
      },
      span: 12,
    }),
    defineLinkedField({
      component: ElInput,
      field: 'seatNote',
      label: '席位说明',
      props: {
        placeholder: '席位数达到 5 后显示',
        rows: 2,
        type: 'textarea',
        'data-testid': 'element-linked-seat-note',
      },
      span: 12,
      visible: values => values.seatCount >= 5,
    }),
  ]
}

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

function createTreeOptions(suffix: string): ElementOption[] {
  return [
    {
      label: `${suffix} 根节点`,
      value: `${suffix}-root-a`,
      children: [
        { label: `${suffix} 叶子节点`, value: `${suffix}-leaf-a` },
      ],
    },
  ]
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

function submitLayoutInline(values: ConfigFormValues): void {
  layoutInlineSubmitted.value = values as ElementKnownValues
}

function submitLayoutGrid(values: ConfigFormValues): void {
  layoutGridSubmitted.value = values as ElementKnownValues
}

function submitContainer(values: ConfigFormValues): void {
  containerSubmitted.value = values as ElementKnownValues
}

function submitLinked(values: ConfigFormValues): void {
  linkedSubmitted.value = values as ElementLinkedValues
}
</script>

<template>
  <div class="config-form-demo" data-testid="element-config-form-example">
    <ElTabs v-model="activeTab" data-testid="element-scenario-tabs">
      <ElTabPane label="布局" name="layout">
        <section class="config-form-demo__section" data-testid="element-layout-scenario">
          <div class="config-form-demo__toolbar">
            <span class="config-form-demo__mode" data-testid="element-layout-mode-label">{{ layoutModeLabel }}</span>
            <ElSwitch
              v-model="layoutMode"
              active-text="grid"
              active-value="grid"
              data-testid="element-layout-mode-switch"
              inactive-text="inline"
              inactive-value="inline"
            />
          </div>

          <ElementConfigForm
            v-if="layoutMode === 'inline'"
            v-model="layoutInlineModel"
            data-testid="element-layout-inline"
            :field-span="12"
            :fields="layoutInlineFields"
            :form-props="{ inline: true, labelWidth: '96px' }"
            :row-props="{ gutter: 16, 'data-testid': 'element-layout-inline-row' }"
            @submit="submitLayoutInline"
          >
            <template #default="{ submit }">
              <div class="config-form-demo__actions">
                <ElButton type="primary" data-testid="element-layout-inline-submit" @click="submit">
                  提交 inline
                </ElButton>
              </div>
            </template>
          </ElementConfigForm>

          <ElementConfigForm
            v-else
            v-model="layoutGridModel"
            data-testid="element-layout-grid-form"
            :field-span="12"
            :fields="layoutGridFields"
            :form-props="{ labelWidth: '96px' }"
            :row-props="{ gutter: 16, 'data-testid': 'element-layout-grid' }"
            @submit="submitLayoutGrid"
          >
            <template #default="{ submit }">
              <div class="config-form-demo__actions">
                <ElButton type="primary" data-testid="element-layout-grid-submit" @click="submit">
                  提交 grid
                </ElButton>
              </div>
            </template>
          </ElementConfigForm>

          <pre class="config-form-demo__preview" data-testid="element-layout-preview">{{ layoutSubmittedText }}</pre>
        </section>
      </ElTabPane>

      <ElTabPane label="容器" name="container">
        <section class="config-form-demo__section" data-testid="element-container-scenario">
          <ElementConfigForm
            v-model="containerModel"
            data-testid="element-container-form"
            :fields="containerFields"
            :form-props="{ labelWidth: '96px' }"
            :row-props="{ gutter: 16, 'data-testid': 'element-container-row' }"
            @submit="submitContainer"
          >
            <template #default="{ submit }">
              <div class="config-form-demo__actions config-form-demo__actions--plain">
                <ElButton type="primary" data-testid="element-container-submit" @click="submit">
                  提交容器
                </ElButton>
              </div>
            </template>
          </ElementConfigForm>

          <pre class="config-form-demo__preview" data-testid="element-container-preview">{{ containerSubmittedText }}</pre>
        </section>
      </ElTabPane>

      <ElTabPane label="联动" name="linked">
        <section class="config-form-demo__section" data-testid="element-linked-scenario">
          <ElementConfigForm
            v-model="linkedModel"
            data-testid="element-linked-form"
            :field-span="12"
            :fields="linkedFields"
            :form-props="{ labelWidth: '96px' }"
            :row-props="{ gutter: 16, 'data-testid': 'element-linked-row' }"
            @submit="submitLinked"
          >
            <template #default="{ submit }">
              <div class="config-form-demo__actions">
                <ElButton type="primary" data-testid="element-linked-submit" @click="submit">
                  提交联动
                </ElButton>
              </div>
            </template>
          </ElementConfigForm>

          <pre class="config-form-demo__preview" data-testid="element-linked-preview">{{ linkedSubmittedText }}</pre>
        </section>
      </ElTabPane>
    </ElTabs>
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
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.4;
}

:deep([data-testid="element-layout-inline-row"]) {
  row-gap: 14px;
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

:deep(.config-form-demo__container-card .config-form-demo__container),
:deep(.config-form-demo__container-collapse .el-collapse-item__content),
:deep(.config-form-demo__container-tabs .el-tab-pane) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  width: 100%;
}

:deep(.config-form-demo__container-collapse .el-collapse-item__content) {
  padding: 14px 0;
}

:deep(.config-form-demo__container-card .el-input),
:deep(.config-form-demo__container-card .el-input-number),
:deep(.config-form-demo__container-card .el-select),
:deep(.config-form-demo__container-card .el-select-v2),
:deep(.config-form-demo__container-card .el-cascader),
:deep(.config-form-demo__container-card .el-date-editor),
:deep(.config-form-demo__container-card .el-time-select),
:deep(.config-form-demo__container-card .el-tree-select),
:deep(.config-form-demo__container-collapse .el-input),
:deep(.config-form-demo__container-collapse .el-input-number),
:deep(.config-form-demo__container-collapse .el-select),
:deep(.config-form-demo__container-collapse .el-select-v2),
:deep(.config-form-demo__container-collapse .el-cascader),
:deep(.config-form-demo__container-collapse .el-date-editor),
:deep(.config-form-demo__container-collapse .el-time-select),
:deep(.config-form-demo__container-collapse .el-tree-select),
:deep(.config-form-demo__container-tabs .el-input),
:deep(.config-form-demo__container-tabs .el-input-number),
:deep(.config-form-demo__container-tabs .el-select),
:deep(.config-form-demo__container-tabs .el-select-v2),
:deep(.config-form-demo__container-tabs .el-cascader),
:deep(.config-form-demo__container-tabs .el-date-editor),
:deep(.config-form-demo__container-tabs .el-time-select),
:deep(.config-form-demo__container-tabs .el-tree-select) {
  width: 100%;
}

:deep(.config-form-demo__container-card .el-textarea),
:deep(.config-form-demo__container-collapse .el-textarea),
:deep(.config-form-demo__container-tabs .el-textarea) {
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
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
