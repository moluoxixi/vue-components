<script lang="ts">
// 示例元信息由 playground 通过 import.meta.glob 读取，用于生成侧栏和页面标题。
export const exampleMeta = {
  name: 'ShadcnConfigForm',
  title: 'ShadcnConfigForm',
  category: '配置表单',
  description: 'shadcn-vue 轻量配置表单包的布局、容器和联动场景。',
  hidden: true,
  order: 60,
}
</script>

<script setup lang="ts">
import type {
  ConfigFormCondition,
  ConfigFormValues,
  DefineConfigFormFieldFactory,
} from '@moluoxixi/config-form-core'
import { defineFields } from '@moluoxixi/config-form-core'
import { ShadcnConfigForm } from '@moluoxixi/config-form-shadcn-vue'
import {
  ShadcnAccordion,
  ShadcnAccordionItem,
  ShadcnCard,
  ShadcnCheckbox,
  ShadcnInput,
  ShadcnNativeSelect,
  ShadcnNumberInput,
  ShadcnOption,
  ShadcnRadio,
  ShadcnRadioGroup,
  ShadcnSlider,
  ShadcnSwitch,
  ShadcnTabPane,
  ShadcnTabs,
  ShadcnTextarea,
} from './components/ShadcnDemoControls'
import { computed, shallowRef } from 'vue'

type ScenarioTab = 'layout' | 'container' | 'linked'

interface ShadcnKnownValues {
  checkbox: boolean
  input: string
  inputNumber: number
  nativeSelect: string
  radio: string
  slider: number
  switchValue: boolean
  textarea: string
}

interface ShadcnLinkedValues extends ShadcnKnownValues {
  advanced: boolean
  enterpriseName: string
  marketing: boolean
  marketingNote: string
  notifyChannel: string
  planType: string
  scheduledNote: string
  seatCount: number
  seatNote: string
}

type ShadcnFieldKey<TValues extends ShadcnKnownValues> = Extract<keyof TValues, string>

const { defineField: defineCommonField } = defineFields<ShadcnKnownValues>()
const { defineField: defineLinkedField } = defineFields<ShadcnLinkedValues>()

const activeTab = shallowRef<ScenarioTab>('layout')
const layoutGridMode = shallowRef(false)
const layoutModeLabel = computed(() => layoutGridMode.value ? 'grid' : 'inline')

const layoutInlineModel = shallowRef<ShadcnKnownValues>(createKnownValues('inline'))
const layoutGridModel = shallowRef<ShadcnKnownValues>(createKnownValues('grid'))
const containerModel = shallowRef<ShadcnKnownValues>(createKnownValues('container'))
const linkedModel = shallowRef<ShadcnLinkedValues>({
  ...createKnownValues('linked'),
  advanced: false,
  enterpriseName: '',
  marketing: false,
  marketingNote: '',
  notifyChannel: 'immediate',
  planType: 'standard',
  scheduledNote: '',
  seatCount: 1,
  seatNote: '',
})

const layoutInlineSubmitted = shallowRef<Partial<ShadcnKnownValues>>({})
const layoutGridSubmitted = shallowRef<Partial<ShadcnKnownValues>>({})
const containerSubmitted = shallowRef<Partial<ShadcnKnownValues>>({})
const linkedSubmitted = shallowRef<Partial<ShadcnLinkedValues>>({})

// shadcn-vue 组件通常由业务侧生成到本地目录，playground 用本地控件模拟这层契约。
const layoutInlineFields = createKnownFields('shadcn-inline', true, defineCommonField)
const layoutGridFields = createKnownFields('shadcn-grid', true, defineCommonField)
const containerFields = [
  defineCommonField({
    colProps: {},
    component: ShadcnCard,
    span: 24,
    props: {
      class: 'shadcn-demo__container-card',
      'data-testid': 'shadcn-container-node',
      title: 'Shadcn Card 容器',
    },
    slots: {
      default: createKnownFields('shadcn-container', false, defineCommonField),
    },
  }),
  defineCommonField({
    colProps: {},
    component: ShadcnAccordion,
    span: 24,
    props: {
      class: 'shadcn-demo__container-accordion',
      'data-testid': 'shadcn-container-accordion-node',
    },
    slots: {
      default: defineCommonField({
        colProps: {},
        component: ShadcnAccordionItem,
        props: {
          title: 'Shadcn Accordion 容器',
        },
        slots: {
          default: createKnownFields('shadcn-container-accordion', false, defineCommonField).slice(0, 4),
        },
      }),
    },
  }),
  defineCommonField({
    colProps: {},
    component: ShadcnTabs,
    span: 24,
    props: {
      active: 'base',
      class: 'shadcn-demo__container-tabs',
      'data-testid': 'shadcn-container-tabs-node',
      items: [
        { label: '基础', value: 'base' },
        { label: '偏好', value: 'preference' },
      ],
    },
    slots: {
      default: [
        defineCommonField({
          colProps: {},
          component: ShadcnTabPane,
          props: {
            name: 'base',
          },
          slots: {
            default: createKnownFields('shadcn-container-tabs-base', false, defineCommonField).slice(0, 3),
          },
        }),
        defineCommonField({
          colProps: {},
          component: ShadcnTabPane,
          props: {
            name: 'preference',
          },
          slots: {
            default: createKnownFields('shadcn-container-tabs-preference', false, defineCommonField).slice(3, 6),
          },
        }),
      ],
    },
  }),
]
const linkedFields = [
  defineLinkedField({
    component: ShadcnSwitch,
    field: 'advanced',
    label: '高级模式',
    props: {
      label: '启用高级字段',
      'data-testid': 'shadcn-linked-advanced-switch',
    },
    span: 12,
  }),
  ...createKnownFields('shadcn-linked', true, defineLinkedField, values => values.advanced),
  ...createLinkedControlFields(),
]

const layoutSubmittedText = computed(() => JSON.stringify({
  grid: layoutGridSubmitted.value,
  inline: layoutInlineSubmitted.value,
}, null, 2))
const containerSubmittedText = computed(() => JSON.stringify(containerSubmitted.value, null, 2))
const linkedSubmittedText = computed(() => JSON.stringify(linkedSubmitted.value, null, 2))

function createKnownValues(seed: string): ShadcnKnownValues {
  return {
    checkbox: false,
    input: '',
    inputNumber: 1,
    nativeSelect: `${seed}-draft`,
    radio: 'standard',
    slider: 10,
    switchValue: false,
    textarea: '',
  }
}

function createKnownFields<TValues extends ShadcnKnownValues>(
  prefix: string,
  withFormItem: boolean,
  defineField: DefineConfigFormFieldFactory<TValues>,
  visible?: ConfigFormCondition<TValues>,
) {
  const suffix = prefix.replace('shadcn-', '')

  return [
    defineField({
      colProps: {},
      component: ShadcnInput,
      field: 'input' as ShadcnFieldKey<TValues>,
      label: withFormItem ? '文本输入' : undefined,
      props: {
        id: `${prefix}-input`,
        placeholder: `${prefix} 文本输入`,
        'data-testid': `${prefix}-input`,
      },
      span: 12,
      visible,
    }),
    defineField({
      colProps: {},
      component: ShadcnNativeSelect,
      field: 'nativeSelect' as ShadcnFieldKey<TValues>,
      label: withFormItem ? '原生选择' : undefined,
      props: {
        id: `${prefix}-native-select`,
        'data-testid': `${prefix}-native-select`,
      },
      slots: {
        default: createSelectOptions(suffix).map(option =>
          defineField({
            colProps: {},
            component: ShadcnOption,
            props: option,
          }),
        ),
      },
      span: 12,
      visible,
    }),
    defineField({
      colProps: {},
      component: ShadcnNumberInput,
      field: 'inputNumber' as ShadcnFieldKey<TValues>,
      label: withFormItem ? '数字输入' : undefined,
      props: {
        id: `${prefix}-input-number`,
        max: 99,
        min: 0,
        'data-testid': `${prefix}-input-number`,
      },
      span: 12,
      visible,
    }),
    defineField({
      colProps: {},
      component: ShadcnSlider,
      field: 'slider' as ShadcnFieldKey<TValues>,
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
      colProps: {},
      component: ShadcnTextarea,
      field: 'textarea' as ShadcnFieldKey<TValues>,
      label: withFormItem ? '多行文本' : undefined,
      props: {
        id: `${prefix}-textarea`,
        placeholder: `${prefix} 多行文本`,
        'data-testid': `${prefix}-textarea`,
      },
      span: 24,
      visible,
    }),
    defineField({
      colProps: {},
      component: ShadcnCheckbox,
      field: 'checkbox' as ShadcnFieldKey<TValues>,
      label: withFormItem ? '勾选' : undefined,
      props: {
        id: `${prefix}-checkbox`,
        label: `${suffix} 开启`,
        'data-testid': `${prefix}-checkbox`,
      },
      span: 12,
      visible,
    }),
    defineField({
      colProps: {},
      component: ShadcnSwitch,
      field: 'switchValue' as ShadcnFieldKey<TValues>,
      label: withFormItem ? '开关' : undefined,
      props: {
        label: `${suffix} 开关`,
        'data-testid': `${prefix}-switch`,
      },
      span: 12,
      visible,
    }),
    defineField({
      colProps: {},
      component: ShadcnRadioGroup,
      field: 'radio' as ShadcnFieldKey<TValues>,
      label: withFormItem ? '单选组' : undefined,
      props: {
        id: `${prefix}-radio`,
        'data-testid': `${prefix}-radio`,
      },
      slots: {
        default: createRadioOptions().map(option =>
          defineField({
            colProps: {},
            component: ShadcnRadio,
            props: option,
          }),
        ),
      },
      span: 12,
      visible,
    }),
  ]
}

function createLinkedControlFields() {
  return [
    defineLinkedField({
      colProps: {},
      component: ShadcnRadioGroup,
      field: 'planType',
      label: '方案类型',
      props: {
        id: 'shadcn-linked-plan-radio',
        'data-testid': 'shadcn-linked-plan-radio',
      },
      slots: {
        default: createRadioOptions().map(option =>
          defineLinkedField({
            colProps: {},
            component: ShadcnRadio,
            props: option,
          }),
        ),
      },
      span: 12,
    }),
    defineLinkedField({
      colProps: {},
      component: ShadcnInput,
      field: 'enterpriseName',
      label: '企业名称',
      props: {
        id: 'shadcn-linked-enterprise-name',
        placeholder: '企业模式显示',
        'data-testid': 'shadcn-linked-enterprise-name',
      },
      span: 12,
      visible: values => values.planType === 'enterprise',
    }),
    defineLinkedField({
      colProps: {},
      component: ShadcnCheckbox,
      field: 'marketing',
      label: '营销设置',
      props: {
        id: 'shadcn-linked-marketing-checkbox',
        label: '启用营销备注',
        'data-testid': 'shadcn-linked-marketing-checkbox',
      },
      span: 12,
    }),
    defineLinkedField({
      colProps: {},
      component: ShadcnTextarea,
      field: 'marketingNote',
      label: '营销备注',
      props: {
        id: 'shadcn-linked-marketing-note',
        placeholder: '勾选后显示',
        'data-testid': 'shadcn-linked-marketing-note',
      },
      span: 12,
      visible: values => values.marketing,
    }),
    defineLinkedField({
      colProps: {},
      component: ShadcnNativeSelect,
      field: 'notifyChannel',
      label: '通知方式',
      props: {
        id: 'shadcn-linked-notify-channel',
        'data-testid': 'shadcn-linked-notify-channel',
      },
      slots: {
        default: createNotifyOptions().map(option =>
          defineLinkedField({
            colProps: {},
            component: ShadcnOption,
            props: option,
          }),
        ),
      },
      span: 12,
    }),
    defineLinkedField({
      colProps: {},
      component: ShadcnInput,
      field: 'scheduledNote',
      label: '预约说明',
      props: {
        id: 'shadcn-linked-scheduled-note',
        placeholder: '预约通知显示',
        'data-testid': 'shadcn-linked-scheduled-note',
      },
      span: 12,
      visible: values => values.notifyChannel === 'scheduled',
    }),
    defineLinkedField({
      colProps: {},
      component: ShadcnNumberInput,
      field: 'seatCount',
      label: '席位数',
      props: {
        id: 'shadcn-linked-seat-count',
        max: 99,
        min: 1,
        'data-testid': 'shadcn-linked-seat-count',
      },
      span: 12,
    }),
    defineLinkedField({
      colProps: {},
      component: ShadcnTextarea,
      field: 'seatNote',
      label: '席位说明',
      props: {
        id: 'shadcn-linked-seat-note',
        placeholder: '席位数达到 5 后显示',
        'data-testid': 'shadcn-linked-seat-note',
      },
      span: 12,
      visible: values => values.seatCount >= 5,
    }),
  ]
}

function createSelectOptions(suffix: string): Array<{ label: string, value: string }> {
  return [
    { label: `${suffix} 草稿`, value: `${suffix}-draft` },
    { label: `${suffix} 启用`, value: `${suffix}-enabled` },
  ]
}

function createRadioOptions(): Array<{ label: string, value: string }> {
  return [
    { label: '标准', value: 'standard' },
    { label: '企业', value: 'enterprise' },
  ]
}

function createNotifyOptions(): Array<{ label: string, value: string }> {
  return [
    { label: '立即通知', value: 'immediate' },
    { label: '预约通知', value: 'scheduled' },
  ]
}

function selectTab(tab: ScenarioTab): void {
  activeTab.value = tab
}

function submitLayoutInline(values: ConfigFormValues): void {
  layoutInlineSubmitted.value = values as ShadcnKnownValues
}

function submitLayoutGrid(values: ConfigFormValues): void {
  layoutGridSubmitted.value = values as ShadcnKnownValues
}

function submitContainer(values: ConfigFormValues): void {
  containerSubmitted.value = values as ShadcnKnownValues
}

function submitLinked(values: ConfigFormValues): void {
  linkedSubmitted.value = values as ShadcnLinkedValues
}
</script>

<template>
  <div class="shadcn-demo" data-testid="shadcn-config-form-example">
    <div class="shadcn-tabs" data-testid="shadcn-scenario-tabs" role="tablist">
      <button
        class="shadcn-tabs__tab"
        :class="{ 'shadcn-tabs__tab--active': activeTab === 'layout' }"
        role="tab"
        type="button"
        :aria-selected="activeTab === 'layout'"
        @click="selectTab('layout')"
      >
        布局
      </button>
      <button
        class="shadcn-tabs__tab"
        :class="{ 'shadcn-tabs__tab--active': activeTab === 'container' }"
        role="tab"
        type="button"
        :aria-selected="activeTab === 'container'"
        @click="selectTab('container')"
      >
        容器
      </button>
      <button
        class="shadcn-tabs__tab"
        :class="{ 'shadcn-tabs__tab--active': activeTab === 'linked' }"
        role="tab"
        type="button"
        :aria-selected="activeTab === 'linked'"
        @click="selectTab('linked')"
      >
        联动
      </button>
    </div>

    <section v-if="activeTab === 'layout'" class="shadcn-demo__section" data-testid="shadcn-layout-scenario">
      <div class="shadcn-demo__toolbar">
        <span class="shadcn-demo__mode" data-testid="shadcn-layout-mode-label">{{ layoutModeLabel }}</span>
        <ShadcnSwitch
          v-model="layoutGridMode"
          data-testid="shadcn-layout-mode-switch"
          label="切换布局模式"
        />
      </div>

      <ShadcnConfigForm
        v-if="!layoutGridMode"
        v-model="layoutInlineModel"
        data-testid="shadcn-layout-inline"
        :field-span="12"
        :fields="layoutInlineFields"
        :row-props="{
          style: { display: 'flex', flexWrap: 'wrap', gap: '14px 16px' },
          'data-testid': 'shadcn-layout-inline-row',
        }"
        @submit="submitLayoutInline"
      >
        <template #default="{ submit }">
          <div class="shadcn-demo__actions">
            <button type="button" class="shadcn-button shadcn-button--primary" data-testid="shadcn-layout-inline-submit" @click="submit">
              提交 inline
            </button>
          </div>
        </template>
      </ShadcnConfigForm>

      <ShadcnConfigForm
        v-else
        v-model="layoutGridModel"
        data-testid="shadcn-layout-grid-form"
        :field-span="12"
        :fields="layoutGridFields"
        :row-props="{ style: { gap: '14px 16px' }, 'data-testid': 'shadcn-layout-grid' }"
        @submit="submitLayoutGrid"
      >
        <template #default="{ submit }">
          <div class="shadcn-demo__actions">
            <button type="button" class="shadcn-button shadcn-button--primary" data-testid="shadcn-layout-grid-submit" @click="submit">
              提交 grid
            </button>
          </div>
        </template>
      </ShadcnConfigForm>

      <pre class="shadcn-demo__preview" data-testid="shadcn-layout-preview">{{ layoutSubmittedText }}</pre>
    </section>

    <section v-if="activeTab === 'container'" class="shadcn-demo__section" data-testid="shadcn-container-scenario">
      <ShadcnConfigForm
        v-model="containerModel"
        data-testid="shadcn-container-form"
        :fields="containerFields"
        :row-props="{ style: { gap: '14px 16px' }, 'data-testid': 'shadcn-container-row' }"
        @submit="submitContainer"
      >
        <template #default="{ submit }">
          <div class="shadcn-demo__actions shadcn-demo__actions--plain">
            <button type="button" class="shadcn-button shadcn-button--primary" data-testid="shadcn-container-submit" @click="submit">
              提交容器
            </button>
          </div>
        </template>
      </ShadcnConfigForm>

      <pre class="shadcn-demo__preview" data-testid="shadcn-container-preview">{{ containerSubmittedText }}</pre>
    </section>

    <section v-if="activeTab === 'linked'" class="shadcn-demo__section" data-testid="shadcn-linked-scenario">
      <ShadcnConfigForm
        v-model="linkedModel"
        data-testid="shadcn-linked-form"
        :field-span="12"
        :fields="linkedFields"
        :row-props="{ style: { gap: '14px 16px' }, 'data-testid': 'shadcn-linked-row' }"
        @submit="submitLinked"
      >
        <template #default="{ submit }">
          <div class="shadcn-demo__actions">
            <button type="button" class="shadcn-button shadcn-button--primary" data-testid="shadcn-linked-submit" @click="submit">
              提交联动
            </button>
          </div>
        </template>
      </ShadcnConfigForm>

      <pre class="shadcn-demo__preview" data-testid="shadcn-linked-preview">{{ linkedSubmittedText }}</pre>
    </section>
  </div>
</template>

<style scoped lang="scss">
.shadcn-demo {
  max-width: 1080px;
}

.shadcn-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid hsl(214deg 32% 91%);
  border-radius: 6px;
  background: hsl(210deg 40% 98%);
}

.shadcn-tabs__tab {
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: hsl(215deg 16% 47%);
  cursor: pointer;
}

.shadcn-tabs__tab--active {
  background: #fff;
  color: hsl(222deg 47% 11%);
  box-shadow: 0 1px 2px hsl(215deg 16% 47% / 16%);
}

.shadcn-demo__section {
  padding-top: 18px;
}

.shadcn-demo__toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.shadcn-demo__mode {
  min-width: 48px;
  color: hsl(215deg 16% 47%);
  font-size: 13px;
  line-height: 1.4;
}

:deep(.shadcn-control) {
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 11px;
  border: 1px solid hsl(214deg 32% 91%);
  border-radius: 6px;
  outline: 0;
  background: #fff;
  color: hsl(222deg 47% 11%);
  font-size: 14px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

:deep(.shadcn-control:focus) {
  border-color: hsl(221deg 83% 53%);
  box-shadow: 0 0 0 3px hsl(221deg 83% 53% / 14%);
}

:deep(.shadcn-control--textarea) {
  min-height: 84px;
  padding: 9px 11px;
  resize: vertical;
}

:deep(.shadcn-slider) {
  width: 100%;
  min-width: 0;
  accent-color: hsl(221deg 83% 53%);
}

:deep(.shadcn-choice) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  color: hsl(222deg 47% 11%);
}

:deep(.shadcn-switch) {
  position: relative;
  width: 42px;
  height: 24px;
  border: 0;
  border-radius: 999px;
  background: hsl(215deg 16% 47%);
  cursor: pointer;
  transition: background 0.16s ease;
}

:deep(.shadcn-switch--checked) {
  background: hsl(221deg 83% 53%);
}

:deep(.shadcn-switch__thumb) {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #fff;
  transition: transform 0.16s ease;
}

:deep(.shadcn-switch--checked .shadcn-switch__thumb) {
  transform: translateX(18px);
}

:deep(.shadcn-radio-group) {
  display: inline-flex;
  gap: 8px;
}

:deep(.shadcn-radio) {
  height: 32px;
  padding: 0 12px;
  border: 1px solid hsl(214deg 32% 91%);
  border-radius: 6px;
  background: #fff;
  color: hsl(222deg 47% 11%);
  cursor: pointer;
}

:deep(.shadcn-radio--checked) {
  border-color: hsl(221deg 83% 53%);
  background: hsl(221deg 83% 53%);
  color: #fff;
}

:deep(.shadcn-card) {
  width: 100%;
  border: 1px solid hsl(214deg 32% 91%);
  border-radius: 6px;
  background: #fff;
}

:deep(.shadcn-card__header) {
  padding: 12px 14px;
  border-bottom: 1px solid hsl(214deg 32% 91%);
  color: hsl(222deg 47% 11%);
  font-size: 14px;
  font-weight: 600;
}

:deep(.shadcn-card__body) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  width: 100%;
  padding: 14px;
}

:deep(.shadcn-card__body .shadcn-control--textarea) {
  grid-column: 1 / -1;
}

/* ConfigForm render 函数创建的容器节点没有当前 SFC 的 scoped attribute，需要整体穿透动态节点选择器。 */
:deep(.shadcn-demo__container-accordion),
:deep(.shadcn-demo__container-tabs) {
  margin-top: 16px;
}

:deep(.shadcn-accordion) {
  width: 100%;
  border: 1px solid hsl(214deg 32% 91%);
  border-radius: 6px;
  background: #fff;
}

:deep(.shadcn-accordion__header) {
  padding: 12px 14px;
  border-bottom: 1px solid hsl(214deg 32% 91%);
  color: hsl(222deg 47% 11%);
  font-size: 14px;
  font-weight: 600;
}

:deep(.shadcn-accordion__body),
:deep(.shadcn-tab-pane) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  width: 100%;
  padding: 14px;
}

:deep(.shadcn-tabs-container) {
  width: 100%;
  border: 1px solid hsl(214deg 32% 91%);
  border-radius: 6px;
  background: #fff;
}

:deep(.shadcn-tabs-container__list) {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid hsl(214deg 32% 91%);
}

:deep(.shadcn-tabs-container__trigger) {
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: hsl(215deg 16% 47%);
}

:deep(.shadcn-tabs-container__trigger--active) {
  background: hsl(210deg 40% 98%);
  color: hsl(222deg 47% 11%);
}

:deep(.shadcn-demo__container-card .shadcn-control--textarea),
:deep(.shadcn-demo__container-accordion .shadcn-control--textarea),
:deep(.shadcn-demo__container-tabs .shadcn-control--textarea) {
  grid-column: 1 / -1;
}

.shadcn-demo__actions {
  display: flex;
  gap: 10px;
  margin: 18px 0;
}

.shadcn-demo__actions--plain {
  margin-top: 0;
}

.shadcn-button {
  height: 34px;
  padding: 0 14px;
  border: 1px solid hsl(214deg 32% 91%);
  border-radius: 6px;
  background: #fff;
  color: hsl(222deg 47% 11%);
  cursor: pointer;
}

.shadcn-button--primary {
  border-color: hsl(221deg 83% 53%);
  background: hsl(221deg 83% 53%);
  color: #fff;
}

.shadcn-demo__preview {
  min-height: 96px;
  margin: 0;
  padding: 14px;
  border: 1px solid hsl(214deg 32% 91%);
  border-radius: 6px;
  background: hsl(210deg 40% 98%);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
