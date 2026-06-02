<script lang="ts">
// 示例元信息由 playground 通过 import.meta.glob 读取，用于生成侧栏和页面标题。
export const exampleMeta = {
  name: 'ShadcnConfigForm',
  title: 'ShadcnConfigForm',
  category: '配置表单',
  description: 'components 包内置 shadcn-vue 配置表单壳的本地组件写回、错误展示和提交场景。',
  order: 60,
}
</script>

<script setup lang="ts">
import type { ConfigFormValues } from '@moluoxixi/components'
import { ShadcnConfigForm, defineFields } from '@moluoxixi/components'
import { computed, defineComponent, h, shallowRef } from 'vue'

interface ShadcnFormValues {
  workspaceName: string
  plan: string
  notes: string
}

const ShadcnInput = defineComponent({
  name: 'ShadcnInput',
  props: {
    id: { type: String, default: '' },
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    function handleInput(event: Event): void {
      emit('update:modelValue', (event.target as HTMLInputElement).value)
    }

    return () => h('input', {
      class: 'shadcn-control',
      id: props.id,
      onInput: handleInput,
      placeholder: props.placeholder,
      value: props.modelValue,
    })
  },
})

const ShadcnSelect = defineComponent({
  name: 'ShadcnSelect',
  props: {
    id: { type: String, default: '' },
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit, slots }) {
    function handleChange(event: Event): void {
      emit('update:modelValue', (event.target as HTMLSelectElement).value)
    }

    return () => h('select', {
      class: 'shadcn-control',
      id: props.id,
      onChange: handleChange,
      value: props.modelValue,
    }, slots.default?.())
  },
})

const ShadcnTextarea = defineComponent({
  name: 'ShadcnTextarea',
  props: {
    id: { type: String, default: '' },
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    function handleInput(event: Event): void {
      emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
    }

    return () => h('textarea', {
      class: 'shadcn-control shadcn-control--textarea',
      id: props.id,
      onInput: handleInput,
      placeholder: props.placeholder,
      value: props.modelValue,
    })
  },
})

const ShadcnOption = defineComponent({
  name: 'ShadcnOption',
  props: {
    label: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  setup(props) {
    return () => h('option', { value: props.value }, props.label)
  },
})

const formModel = shallowRef<ShadcnFormValues>({
  workspaceName: '',
  plan: 'starter',
  notes: '',
})
const submittedValues = shallowRef<Partial<ShadcnFormValues>>({})
const { defineField } = defineFields<ShadcnFormValues>()

const fields = [
  defineField({
    component: ShadcnInput,
    field: 'workspaceName',
    label: '工作区名称',
    props: {
      id: 'workspaceName',
      placeholder: '请输入 Shadcn 工作区名称',
    },
    rules: [{ message: '请输入工作区名称', required: true }],
    span: 12,
  }),
  defineField({
    component: ShadcnSelect,
    field: 'plan',
    label: '套餐',
    props: {
      id: 'plan',
    },
    rules: [{ message: '请选择套餐', required: true }],
    slots: {
      default: [
        defineField({
          component: ShadcnOption,
          props: { label: 'Starter', value: 'starter' },
        }),
        defineField({
          component: ShadcnOption,
          props: { label: 'Enterprise', value: 'enterprise' },
        }),
      ],
    },
    span: 12,
  }),
  defineField({
    component: ShadcnTextarea,
    field: 'notes',
    label: '企业备注',
    props: {
      id: 'notes',
      placeholder: '请输入 Shadcn 企业备注',
    },
    span: 24,
    visible: values => values.plan === 'enterprise',
  }),
  defineField({
    component: 'section',
    props: {
      class: 'shadcn-demo__hint',
    },
    slots: {
      default: () => h('span', '容器节点不会生成 FormItem'),
    },
    span: 24,
  }),
]

const submittedText = computed(() => JSON.stringify(submittedValues.value, null, 2))

function handleSubmit(values: ConfigFormValues): void {
  submittedValues.value = values as ShadcnFormValues
}
</script>

<template>
  <div class="shadcn-demo" data-testid="shadcn-config-form-example">
    <ShadcnConfigForm
      v-model="formModel"
      :fields="fields"
      :row-props="{ style: { gap: '14px 16px' } }"
      @submit="handleSubmit"
    >
      <template #default="{ submit, resetFields }">
        <div class="shadcn-demo__actions">
          <button type="button" class="shadcn-button shadcn-button--primary" data-testid="shadcn-config-submit" @click="submit">
            提交
          </button>
          <button type="button" class="shadcn-button" data-testid="shadcn-config-reset" @click="resetFields">
            重置
          </button>
        </div>
      </template>
    </ShadcnConfigForm>

    <pre class="shadcn-demo__preview" data-testid="shadcn-config-preview">{{ submittedText }}</pre>
  </div>
</template>

<style scoped lang="scss">
.shadcn-demo {
  max-width: 760px;
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
  border-color: hsl(222deg 84% 45%);
  box-shadow: 0 0 0 3px hsl(222deg 84% 45% / 14%);
}

:deep(.shadcn-control--textarea) {
  min-height: 84px;
  padding: 9px 11px;
  resize: vertical;
}

:deep(.shadcn-demo__hint) {
  padding: 9px 11px;
  border: 1px solid hsl(214deg 32% 91%);
  border-radius: 6px;
  background: hsl(210deg 40% 98%);
  color: hsl(215deg 16% 47%);
  font-size: 13px;
}

.shadcn-demo__actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
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
  border-color: hsl(222deg 84% 45%);
  background: hsl(222deg 84% 45%);
  color: #fff;
}

.shadcn-demo__preview {
  min-height: 120px;
  margin: 18px 0 0;
  padding: 14px;
  border: 1px solid hsl(214deg 32% 91%);
  border-radius: 6px;
  background: hsl(210deg 40% 98%);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
