import type {
  DesignerDefaultValueKind,
  DesignerPropertySetterDefinition,
} from '@moluoxixi/config-form-designer'
import {
  AntdChoiceDefaultSetter,
  AntdOptionSourceSetter,
} from '../components'

interface NumericSetterConstraints {
  min?: number
  max?: number
  step?: number
}

export function propSetter(
  key: string,
  label: string,
  control: DesignerPropertySetterDefinition['control'],
  options?: DesignerPropertySetterDefinition['options'],
  constraints?: NumericSetterConstraints,
): DesignerPropertySetterDefinition {
  return { key, label, path: ['props', key], control, ...(options ? { options } : {}), ...constraints }
}

export function defaultValueSetter(valueKind: DesignerDefaultValueKind): DesignerPropertySetterDefinition {
  return { key: 'defaultValue', label: 'Default value', path: ['defaultValue'], control: 'defaultValue', valueKind }
}

export const placeholderSetter = propSetter('placeholder', 'Placeholder', 'text')
export const allowClearSetter = propSetter('allowClear', 'Allow clear', 'boolean')
export const disabledSetter = propSetter('disabled', 'Disabled', 'boolean')
export const optionsSetter = propSetter('options', 'Static options', 'options')
export const optionSourceSetter: DesignerPropertySetterDefinition = {
  key: 'optionSource',
  label: 'Option source',
  path: ['props', 'optionSource'],
  control: 'custom',
  component: AntdOptionSourceSetter,
}

export function choiceDefaultValueSetter(
  valueKind: Extract<DesignerDefaultValueKind, 'select' | 'multiselect'>,
): DesignerPropertySetterDefinition {
  return {
    key: 'defaultValue',
    label: 'Default value',
    path: ['defaultValue'],
    control: 'custom',
    component: AntdChoiceDefaultSetter,
    componentProps: { kind: valueKind },
    optionsPath: ['props', 'options'],
    optionSourcePath: ['props', 'optionSource'],
    valueKind,
  }
}
