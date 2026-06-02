import type { InjectionKey, PropType } from 'vue'
import { computed, defineComponent, h, inject, provide } from 'vue'

interface RadioGroupContext {
  value: () => string
  setValue: (value: string) => void
}

interface TabsContext {
  active: () => string
}

interface ShadcnTabItem {
  label: string
  value: string
}

interface ShadcnDemoOption {
  label: string
  value: string
}

const radioGroupKey: InjectionKey<RadioGroupContext> = Symbol('shadcn-demo-radio-group')
const tabsKey: InjectionKey<TabsContext> = Symbol('shadcn-demo-tabs')

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

export const ShadcnAccordion = defineComponent({
  name: 'ShadcnAccordion',
  inheritAttrs: false,
  setup(_props, { attrs, slots }) {
    return () => h('section', {
      ...attrs,
      class: ['shadcn-accordion', attrs.class],
    }, slots.default?.())
  },
})

export const ShadcnAccordionItem = defineComponent({
  name: 'ShadcnAccordionItem',
  inheritAttrs: false,
  props: {
    title: { type: String, default: '' },
  },
  setup(props, { attrs, slots }) {
    return () => h('article', {
      ...attrs,
      class: ['shadcn-accordion__item', attrs.class],
    }, [
      h('div', { class: 'shadcn-accordion__header' }, props.title),
      h('div', { class: 'shadcn-accordion__body' }, slots.default?.()),
    ])
  },
})

export const ShadcnTabs = defineComponent({
  name: 'ShadcnTabs',
  inheritAttrs: false,
  props: {
    active: { type: String, default: '' },
    items: { type: Array as PropType<ShadcnTabItem[]>, default: () => [] },
  },
  setup(props, { attrs, slots }) {
    provide(tabsKey, {
      active: () => props.active,
    })

    return () => h('section', {
      ...attrs,
      class: ['shadcn-tabs-container', attrs.class],
    }, [
      h('div', { class: 'shadcn-tabs-container__list', role: 'tablist' }, props.items.map(item =>
        h('button', {
          'aria-selected': String(props.active === item.value),
          'class': ['shadcn-tabs-container__trigger', { 'shadcn-tabs-container__trigger--active': props.active === item.value }],
          'role': 'tab',
          'type': 'button',
        }, item.label),
      )),
      h('div', { class: 'shadcn-tabs-container__content' }, slots.default?.()),
    ])
  },
})

export const ShadcnTabPane = defineComponent({
  name: 'ShadcnTabPane',
  inheritAttrs: false,
  props: {
    name: { type: String, default: '' },
  },
  setup(props, { attrs, slots }) {
    const tabs = inject(tabsKey)!
    const active = computed(() => tabs.active() === props.name)

    return () => active.value
      ? h('div', {
          ...attrs,
          class: ['shadcn-tab-pane', attrs.class],
          role: 'tabpanel',
        }, slots.default?.())
      : null
  },
})

export const ShadcnInput = defineComponent({
  name: 'ShadcnInput',
  props: {
    id: { type: String, default: '' },
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    type: { type: String, default: 'text' },
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
      type: props.type,
      value: props.modelValue,
    })
  },
})

export const ShadcnPasswordInput = defineComponent({
  name: 'ShadcnPasswordInput',
  props: {
    id: { type: String, default: '' },
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    /**
     * shadcn-vue 的 Password 字段通常仍是 Input 语义，这里保留独立组件名用于 playground 覆盖。
     */
    function handleInput(event: Event): void {
      emit('update:modelValue', (event.target as HTMLInputElement).value)
    }

    return () => h('input', {
      class: 'shadcn-control',
      id: props.id,
      onInput: handleInput,
      placeholder: props.placeholder,
      type: 'password',
      value: props.modelValue,
    })
  },
})

export const ShadcnSearchInput = defineComponent({
  name: 'ShadcnSearchInput',
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
      type: 'search',
      value: props.modelValue,
    })
  },
})

export const ShadcnNumberInput = defineComponent({
  name: 'ShadcnNumberInput',
  props: {
    id: { type: String, default: '' },
    max: { type: Number, default: 100 },
    min: { type: Number, default: 0 },
    modelValue: { type: Number, default: 0 },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    function handleInput(event: Event): void {
      emit('update:modelValue', Number((event.target as HTMLInputElement).value))
    }

    return () => h('input', {
      class: 'shadcn-control',
      id: props.id,
      max: props.max,
      min: props.min,
      onInput: handleInput,
      type: 'number',
      value: props.modelValue,
    })
  },
})

export const ShadcnSlider = defineComponent({
  name: 'ShadcnSlider',
  props: {
    max: { type: Number, default: 100 },
    min: { type: Number, default: 0 },
    modelValue: { type: Number, default: 0 },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    function handleInput(event: Event): void {
      emit('update:modelValue', Number((event.target as HTMLInputElement).value))
    }

    return () => h('input', {
      class: 'shadcn-slider',
      max: props.max,
      min: props.min,
      onInput: handleInput,
      type: 'range',
      value: props.modelValue,
    })
  },
})

export const ShadcnDatePicker = defineComponent({
  name: 'ShadcnDatePicker',
  props: {
    id: { type: String, default: '' },
    modelValue: { type: String, default: '' },
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
      type: 'date',
      value: props.modelValue,
    })
  },
})

export const ShadcnTimePicker = defineComponent({
  name: 'ShadcnTimePicker',
  props: {
    id: { type: String, default: '' },
    modelValue: { type: String, default: '' },
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
      type: 'time',
      value: props.modelValue,
    })
  },
})

export const ShadcnColorPicker = defineComponent({
  name: 'ShadcnColorPicker',
  props: {
    id: { type: String, default: '' },
    modelValue: { type: String, default: '#2563eb' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    function handleInput(event: Event): void {
      emit('update:modelValue', (event.target as HTMLInputElement).value)
    }

    return () => h('input', {
      class: 'shadcn-color',
      id: props.id,
      onInput: handleInput,
      type: 'color',
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

export const ShadcnCombobox = defineComponent({
  name: 'ShadcnCombobox',
  props: {
    id: { type: String, default: '' },
    modelValue: { type: String, default: '' },
    options: { type: Array as PropType<ShadcnDemoOption[]>, default: () => [] },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    function handleInput(event: Event): void {
      emit('update:modelValue', (event.target as HTMLInputElement).value)
    }

    return () => h('div', { class: 'shadcn-combobox' }, [
      h('input', {
        class: 'shadcn-control',
        id: props.id,
        list: `${props.id}-options`,
        onInput: handleInput,
        placeholder: props.placeholder,
        value: props.modelValue,
      }),
      h('datalist', { id: `${props.id}-options` }, props.options.map(option =>
        h('option', { value: option.value }, option.label),
      )),
    ])
  },
})

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
