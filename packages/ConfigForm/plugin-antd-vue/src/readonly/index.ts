import type { ReadonlyAdapterRegistry } from '@moluoxixi/config-form/plugins'
import {
  createAntdVueChoiceReadonlyAdapter,
  createAntdVueSwitchReadonlyAdapter,
  createRawReadonlyAdapter,
} from './adapters'

const rawReadonlyAdapter = createRawReadonlyAdapter()

/** Ant Design Vue 内置字段组件的只读展示适配表。 */
export const ANTD_VUE_READONLY_ADAPTERS: ReadonlyAdapterRegistry = Object.freeze({
  AAutoComplete: createAntdVueChoiceReadonlyAdapter(['options']),
  ACascader: createAntdVueChoiceReadonlyAdapter(['options'], true),
  ACheckbox: rawReadonlyAdapter,
  ACheckboxGroup: createAntdVueChoiceReadonlyAdapter(['options']),
  ADatePicker: rawReadonlyAdapter,
  AInput: rawReadonlyAdapter,
  AInputNumber: rawReadonlyAdapter,
  AInputPassword: rawReadonlyAdapter,
  AInputSearch: rawReadonlyAdapter,
  ARadioGroup: createAntdVueChoiceReadonlyAdapter(['options']),
  ARangePicker: rawReadonlyAdapter,
  ARate: rawReadonlyAdapter,
  ASelect: createAntdVueChoiceReadonlyAdapter(['options']),
  ASlider: rawReadonlyAdapter,
  ASwitch: createAntdVueSwitchReadonlyAdapter(),
  ATextarea: rawReadonlyAdapter,
  ATimePicker: rawReadonlyAdapter,
  ATimeRangePicker: rawReadonlyAdapter,
  ATreeSelect: createAntdVueChoiceReadonlyAdapter(['treeData', 'options'], true),
})
