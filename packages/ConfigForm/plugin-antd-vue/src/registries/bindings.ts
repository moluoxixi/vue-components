import type { AntdVueFieldBinding } from '../types'

/** 当前插件内置支持的 Ant Design Vue 字段组件绑定表。 */
export const ANTD_VUE_FIELD_BINDINGS: Readonly<Record<string, AntdVueFieldBinding>> = Object.freeze({
  AAutoComplete: { valueProp: 'value', trigger: 'update:value' },
  ACascader: { valueProp: 'value', trigger: 'update:value' },
  ACheckbox: { valueProp: 'checked', trigger: 'update:checked' },
  ACheckboxGroup: { valueProp: 'value', trigger: 'update:value' },
  ADatePicker: { valueProp: 'value', trigger: 'update:value' },
  AInput: { valueProp: 'value', trigger: 'update:value' },
  AInputNumber: { valueProp: 'value', trigger: 'update:value' },
  AInputPassword: { valueProp: 'value', trigger: 'update:value' },
  AInputSearch: { valueProp: 'value', trigger: 'update:value' },
  ARangePicker: { valueProp: 'value', trigger: 'update:value' },
  ARate: { valueProp: 'value', trigger: 'update:value' },
  ARadioGroup: { valueProp: 'value', trigger: 'update:value' },
  ASelect: { valueProp: 'value', trigger: 'update:value' },
  ASlider: { valueProp: 'value', trigger: 'update:value' },
  ASwitch: {
    valueProp: 'checked',
    trigger: 'update:checked',
    props: { style: { width: '44px' } },
  },
  ATextarea: { valueProp: 'value', trigger: 'update:value' },
  ATimePicker: { valueProp: 'value', trigger: 'update:value' },
  ATimeRangePicker: { valueProp: 'value', trigger: 'update:value' },
  ATreeSelect: { valueProp: 'value', trigger: 'update:value' },
})
