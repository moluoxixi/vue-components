import type { ReadonlyAdapterRegistry } from '@moluoxixi/config-form/plugins'
import {
  createElementPlusChoiceReadonlyAdapter,
  createElementPlusColorReadonlyAdapter,
  createElementPlusSwitchReadonlyAdapter,
  createRawReadonlyAdapter,
} from './adapters'

const rawReadonlyAdapter = createRawReadonlyAdapter()

/** Element Plus 内置字段组件的只读展示适配表。 */
export const ELEMENT_PLUS_READONLY_ADAPTERS: ReadonlyAdapterRegistry = Object.freeze({
  ElAutocomplete: createElementPlusChoiceReadonlyAdapter(['options']),
  ElCascader: createElementPlusChoiceReadonlyAdapter(['options'], true),
  ElCheckbox: rawReadonlyAdapter,
  ElCheckboxGroup: createElementPlusChoiceReadonlyAdapter(['options']),
  ElColorPicker: createElementPlusColorReadonlyAdapter(),
  ElDatePicker: rawReadonlyAdapter,
  ElInput: rawReadonlyAdapter,
  ElInputNumber: rawReadonlyAdapter,
  ElRadio: rawReadonlyAdapter,
  ElRadioGroup: createElementPlusChoiceReadonlyAdapter(['options']),
  ElRate: rawReadonlyAdapter,
  ElSelect: createElementPlusChoiceReadonlyAdapter(['options']),
  ElSelectV2: createElementPlusChoiceReadonlyAdapter(['options']),
  ElSwitch: createElementPlusSwitchReadonlyAdapter(),
  ElTimePicker: rawReadonlyAdapter,
  ElTimeSelect: rawReadonlyAdapter,
  ElTreeSelect: createElementPlusChoiceReadonlyAdapter(['data', 'options']),
})
