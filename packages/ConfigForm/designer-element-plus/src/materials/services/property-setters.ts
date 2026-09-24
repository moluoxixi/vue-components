import type {
  DesignerDefaultValueKind,
  DesignerOptionValueType,
  DesignerPropertySetterDefinition,
} from '@moluoxixi/config-form-designer'
import { ElementChoiceDefaultSetter } from '../components'

export {
  DESIGNER_OPTION_VALUE_TYPES,
  DESIGNER_TEXT_NUMBER_OPTION_VALUE_TYPES,
} from '@moluoxixi/config-form-designer'

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
export function optionsSetter(
  optionValueTypes: readonly DesignerOptionValueType[],
): DesignerPropertySetterDefinition {
  return {
    ...propSetter('options', 'Static options', 'options'),
    optionValueTypes,
  }
}

export function choiceDefaultValueSetter(
  valueKind: Extract<DesignerDefaultValueKind, 'select' | 'multiselect'>,
  optionValueTypes: readonly DesignerOptionValueType[],
): DesignerPropertySetterDefinition {
  return {
    key: 'defaultValue',
    label: 'Default value',
    path: ['defaultValue'],
    control: 'custom',
    component: ElementChoiceDefaultSetter,
    componentProps: { kind: valueKind, optionValueTypes },
    optionsPath: ['props', 'options'],
    optionValueTypes,
    valueKind,
  }
}
