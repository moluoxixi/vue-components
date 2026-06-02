import type { InjectionKey } from 'vue'
import { computed, defineComponent, h, inject, provide } from 'vue'

interface RadioGroupContext {
  value: () => string
  setValue: (value: string) => void
}

const radioGroupKey: InjectionKey<RadioGroupContext> = Symbol('shadcn-demo-radio-group')

/** Playground 本地 shadcn 风格控件，用于模拟业务项目生成到本地目录的组件。 */
export const ShadcnCard = defineComponent({
  name: 'ShadcnCard',
  inheritAttrs: false,
  props: {
    title: { type: String, default: '' },
  },
  setup(props, { attrs, slots }) {
    return () => h('section', {
      ...attrs,
      class: ['shadcn-card', attrs.class],
    }, [
      h('div', { class: 'shadcn-card__header' }, props.title),
      h('div', { class: 'shadcn-card__body' }, slots.default?.()),
    ])
  },
})

export const ShadcnInput = defineComponent({
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

export const ShadcnTextarea = defineComponent({
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

export const ShadcnNativeSelect = defineComponent({
  name: 'NativeSelect',
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

export const ShadcnSelect = ShadcnNativeSelect

export const ShadcnOption = defineComponent({
  name: 'ShadcnOption',
  props: {
    label: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  setup(props) {
    return () => h('option', { value: props.value }, props.label)
  },
})

export const ShadcnCheckbox = defineComponent({
  name: 'ShadcnCheckbox',
  props: {
    id: { type: String, default: '' },
    label: { type: String, default: '' },
    modelValue: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    function handleChange(event: Event): void {
      emit('update:modelValue', (event.target as HTMLInputElement).checked)
    }

    return () => h('label', { class: 'shadcn-choice' }, [
      h('input', {
        checked: props.modelValue,
        id: props.id,
        onChange: handleChange,
        type: 'checkbox',
      }),
      h('span', props.label),
    ])
  },
})

export const ShadcnSwitch = defineComponent({
  name: 'ShadcnSwitch',
  props: {
    label: { type: String, default: '' },
    modelValue: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('button', {
      'aria-checked': String(props.modelValue),
      'aria-label': props.label,
      'class': ['shadcn-switch', { 'shadcn-switch--checked': props.modelValue }],
      'onClick': () => emit('update:modelValue', !props.modelValue),
      'role': 'switch',
      'type': 'button',
    }, [
      h('span', { class: 'shadcn-switch__thumb' }),
    ])
  },
})

export const ShadcnRadioGroup = defineComponent({
  name: 'ShadcnRadioGroup',
  props: {
    id: { type: String, default: '' },
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit, slots }) {
    provide(radioGroupKey, {
      setValue: value => emit('update:modelValue', value),
      value: () => props.modelValue,
    })

    return () => h('div', {
      class: 'shadcn-radio-group',
      id: props.id,
      role: 'radiogroup',
    }, slots.default?.())
  },
})

export const ShadcnRadio = defineComponent({
  name: 'ShadcnRadio',
  props: {
    label: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  setup(props) {
    const group = inject(radioGroupKey)!
    const checked = computed(() => group.value() === props.value)

    return () => h('button', {
      'aria-checked': String(checked.value),
      'class': ['shadcn-radio', { 'shadcn-radio--checked': checked.value }],
      'onClick': () => group.setValue(props.value),
      'role': 'radio',
      'type': 'button',
    }, props.label)
  },
})
