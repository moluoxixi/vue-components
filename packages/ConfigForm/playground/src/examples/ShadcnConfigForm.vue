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
  ShadcnCard,
  ShadcnCheckbox,
  ShadcnInput,
  ShadcnNativeSelect,
  ShadcnOption,
  ShadcnRadio,
  ShadcnRadioGroup,
  ShadcnSwitch,
  ShadcnTextarea,
} from './components/ShadcnDemoControls'
import { computed, shallowRef } from 'vue'

type ScenarioTab = 'layout' | 'container' | 'linked'

interface ShadcnKnownValues {
  checkbox: boolean
  input: string
  nativeSelect: string
  radio: string
  switchValue: boolean
  textarea: string
}

interface ShadcnLinkedValues extends ShadcnKnownValues {
  advanced: boolean
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
    props: {
      class: 'shadcn-demo__container-card',
      'data-testid': 'shadcn-container-node',
      title: 'Shadcn Card 容器',
    },
    slots: {
      default: createKnownFields('shadcn-container', false, defineCommonField),
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
    nativeSelect: `${seed}-draft`,
    radio: 'standard',
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
