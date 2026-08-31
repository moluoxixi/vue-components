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
  KeyRound,
  LayoutGrid,
  LayoutPanelTop,
  List,
  ListCollapse,
  PanelBottom,
  PanelsTopLeft,
  Rows3,
  Search as SearchIcon,
  SlidersHorizontal,
  Square,
  Star,
  TextCursorInput,
  ToggleLeft,
  Type as TypeIcon,
} from '@lucide/vue'
import {
  Card,
  Collapse,
  CollapsePanel,
  DatePicker,
  Input,
  InputNumber,
  Rate,
  Slider,
  Switch,
  TabPane,
  Tabs,
  TimePicker,
} from 'ant-design-vue'
import AntdAutoCompleteField from './components/AntdAutoCompleteField.vue'
import AntdCheckboxField from './components/AntdCheckboxField.vue'
import AntdChoiceDefaultSetter from './components/AntdChoiceDefaultSetter.vue'
import AntdOptionSourceSetter from './components/AntdOptionSourceSetter.vue'
import AntdRadioField from './components/AntdRadioField.vue'
import AntdSection from './components/AntdSection.vue'
import AntdSelectField from './components/AntdSelectField.vue'
import AntdFlexLayout from './layout/AntdFlexLayout.vue'
import AntdGridLayout from './layout/AntdGridLayout.vue'
import { createAntdVueOptionDiagnostics } from './options'
import {
  renderAntdVueChoiceReadonly,
  renderAntdVuePasswordReadonly,
  renderAntdVueRawReadonly,
  renderAntdVueSwitchReadonly,
} from './readonly'

export {
  AlignLeft,
  AntdAutoCompleteField,
  AntdCheckboxField,
  AntdFlexLayout,
  AntdGridLayout,
  AntdRadioField,
  AntdSection,
  AntdSelectField,
  Calendar,
  Card,
  CheckSquare,
  CircleDot,
  Clock,
  Collapse,
  CollapsePanel,
  createAntdVueOptionDiagnostics,
  DatePicker,
  Hash,
  Input,
  InputNumber,
  KeyRound,
  LayoutGrid,
  LayoutPanelTop,
  List,
  ListCollapse,
  PanelBottom,
  PanelsTopLeft,
  Rate,
  renderAntdVueChoiceReadonly,
  renderAntdVuePasswordReadonly,
  renderAntdVueRawReadonly,
  renderAntdVueSwitchReadonly,
  Rows3,
  SearchIcon,
  Slider,
  SlidersHorizontal,
  Square,
  Star,
  Switch,
  TabPane,
  Tabs,
  TextCursorInput,
  TimePicker,
  ToggleLeft,
  TypeIcon,
}

interface AntdSourceOptions {
  native?: boolean
  options?: DesignerSourceMaterialBinding['options']
  render?: DesignerSourceMaterialBinding['render']
  staticProps?: DesignerSourceMaterialBinding['staticProps']
}

export function antdSource(
  configComponent: string,
  tag: string,
  options: AntdSourceOptions = {},
): DesignerSourceMaterialBinding {
  return {
    configComponent,
    tag,
    render: options.render ?? 'component',
    ...(options.native
      ? {}
      : {
          library: {
            packageName: 'ant-design-vue',
            plugin: 'Antd',
            stylesheet: 'ant-design-vue/dist/reset.css',
          },
        }),
    ...(options.options ? { options: options.options } : {}),
    ...(options.staticProps ? { staticProps: options.staticProps } : {}),
  }
}

interface NumericSetterConstraints { min?: number, max?: number, step?: number }

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

const optionDefaults = [{ label: 'Option A', value: 'a' }, { label: 'Option B', value: 'b' }]
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
    component: AntdChoiceDefaultSetter,
    componentProps: { kind: valueKind },
    optionsPath: ['props', 'options'],
    optionSourcePath: ['props', 'optionSource'],
    valueKind,
  }
}

export const valueBinding = { valueProp: 'value', trigger: 'update:value' }
export const checkedBinding = { valueProp: 'checked', trigger: 'update:checked' }
