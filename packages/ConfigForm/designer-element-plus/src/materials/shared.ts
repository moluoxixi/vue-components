import type {
  DesignerDefaultValueKind,
  DesignerPropertySetterDefinition,
  DesignerSourceMaterialBinding,
} from '@moluoxixi/config-form-designer'
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  CircleDot,
  Clock,
  Hash,
  LayoutGrid,
  LayoutPanelTop,
  List,
  ListCollapse,
  PanelBottom,
  PanelsTopLeft,
  Rows3,
  Square,
  ToggleLeft,
  Type as TypeIcon,
} from '@lucide/vue'
import {
  ElCard,
  ElCollapse,
  ElCollapseItem,
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTimePicker,
} from 'element-plus'
import {
  ElementCheckboxField,
  ElementChoiceDefaultSetter,
  ElementFlexLayout,
  ElementGridLayout,
  ElementOptionSourceSetter,
  ElementRadioField,
  ElementSection,
  ElementSelectField,
} from '../components'
import { createElementPlusOptionDiagnostics } from '../options'
import {
  renderElementPlusChoiceReadonly,
  renderElementPlusRawReadonly,
  renderElementPlusSwitchReadonly,
} from '../readonly'

export {
  AlignLeft,
  Calendar,
  CheckSquare,
  CircleDot,
  Clock,
  createElementPlusOptionDiagnostics,
  ElCard,
  ElCollapse,
  ElCollapseItem,
  ElDatePicker,
  ElementCheckboxField,
  ElementFlexLayout,
  ElementGridLayout,
  ElementRadioField,
  ElementSection,
  ElementSelectField,
  ElInput,
  ElInputNumber,
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTimePicker,
  Hash,
  LayoutGrid,
  LayoutPanelTop,
  List,
  ListCollapse,
  PanelBottom,
  PanelsTopLeft,
  renderElementPlusChoiceReadonly,
  renderElementPlusRawReadonly,
  renderElementPlusSwitchReadonly,
  Rows3,
  Square,
  ToggleLeft,
  TypeIcon,
}

interface ElementSourceOptions {
  native?: boolean
  options?: DesignerSourceMaterialBinding['options']
  render?: DesignerSourceMaterialBinding['render']
  staticProps?: DesignerSourceMaterialBinding['staticProps']
}

export function elementSource(
  configComponent: string,
  tag: string,
  options: ElementSourceOptions = {},
): DesignerSourceMaterialBinding {
  return {
    configComponent,
    tag,
    render: options.render ?? 'component',
    ...(options.native
      ? {}
      : {
          library: {
            packageName: 'element-plus',
            plugin: 'ElementPlus',
            stylesheet: 'element-plus/dist/index.css',
          },
        }),
    ...(options.options ? { options: options.options } : {}),
    ...(options.staticProps ? { staticProps: options.staticProps } : {}),
  }
}

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

const optionDefaults = [
  { label: 'Option A', value: 'a' },
  { label: 'Option B', value: 'b' },
]

export function defaultOptions(): typeof optionDefaults {
  return optionDefaults.map(option => ({ ...option }))
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
