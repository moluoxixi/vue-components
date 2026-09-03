import type {
  DesignerDefaultValueKind,
  DesignerPropertySetterDefinition,
} from '@moluoxixi/config-form-designer'
import {
  ElementChoiceDefaultSetter,
  ElementOptionSourceSetter,
} from '../../components'

interface NumericSetterConstraints {
  min?: number
  max?: number
  step?: number
}

function setter(
  key: string,
  label: string,
  path: string[],
  control: DesignerPropertySetterDefinition['control'],
  options?: DesignerPropertySetterDefinition['options'],
  constraints?: NumericSetterConstraints,
): DesignerPropertySetterDefinition {
  return { key, label, path, control, ...(options ? { options } : {}), ...constraints }
}

export function propSetter(
  key: string,
  label: string,
  control: DesignerPropertySetterDefinition['control'],
  options?: DesignerPropertySetterDefinition['options'],
  constraints?: NumericSetterConstraints,
): DesignerPropertySetterDefinition {
  return setter(key, label, ['props', key], control, options, constraints)
}

export function defaultValueSetter(
  valueKind: DesignerDefaultValueKind,
  optionsPath?: string[],
): DesignerPropertySetterDefinition {
  return {
    key: 'defaultValue',
    label: 'Default value',
    path: ['defaultValue'],
    control: 'defaultValue',
    valueKind,
    ...(optionsPath ? { optionsPath } : {}),
  }
}

export const placeholderSetter = propSetter('placeholder', 'Placeholder', 'text')
export const clearableSetter = propSetter('clearable', 'Clearable', 'boolean')
export const disabledSetter = propSetter('disabled', 'Disabled', 'boolean')
export const optionsSetter = propSetter('options', 'Static options', 'options')
export const optionSourceSetter: DesignerPropertySetterDefinition = {
  key: 'optionSource',
  label: 'Option source',
  path: ['props', 'optionSource'],
  control: 'custom',
  component: ElementOptionSourceSetter,
}

export function choiceDefaultValueSetter(
  valueKind: Extract<DesignerDefaultValueKind, 'select' | 'multiselect'>,
): DesignerPropertySetterDefinition {
  return {
    key: 'defaultValue',
    label: 'Default value',
    path: ['defaultValue'],
    control: 'custom',
    component: ElementChoiceDefaultSetter,
    componentProps: { kind: valueKind },
    optionsPath: ['props', 'options'],
    optionSourcePath: ['props', 'optionSource'],
    valueKind,
  }
}
