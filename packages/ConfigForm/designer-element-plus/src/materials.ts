import type {
  DesignerMaterialDefinition,
  DesignerPropertySetterDefinition,
} from '@moluoxixi/config-form-designer'
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  CircleDot,
  Clock,
  Hash,
  LayoutPanelTop,
  List,
  ListCollapse,
  PanelBottom,
  PanelsTopLeft,
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
import ElementCheckboxField from './components/ElementCheckboxField.vue'
import ElementRadioField from './components/ElementRadioField.vue'
import ElementSection from './components/ElementSection.vue'
import ElementSelectField from './components/ElementSelectField.vue'

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

function propSetter(
  key: string,
  label: string,
  control: DesignerPropertySetterDefinition['control'],
  options?: DesignerPropertySetterDefinition['options'],
  constraints?: NumericSetterConstraints,
): DesignerPropertySetterDefinition {
  return setter(key, label, ['props', key], control, options, constraints)
}

const placeholderSetter = propSetter('placeholder', 'Placeholder', 'text')
const clearableSetter = propSetter('clearable', 'Clearable', 'boolean')
const disabledSetter = propSetter('disabled', 'Disabled', 'boolean')
const optionsSetter = propSetter('options', 'Options', 'options')
const optionDefaults = [
  { label: 'Option A', value: 'a' },
  { label: 'Option B', value: 'b' },
]

function defaultOptions(): typeof optionDefaults {
  return optionDefaults.map(option => ({ ...option }))
}

export const ELEMENT_PLUS_DESIGNER_MATERIALS: DesignerMaterialDefinition[] = [
  {
    key: 'element.input',
    version: 1,
    kind: 'field',
    title: 'Input',
    category: 'Fields',
    icon: TypeIcon,
    runtime: { component: ElInput },
    setters: [placeholderSetter, clearableSetter, propSetter('maxlength', 'Max length', 'number', undefined, { min: 0, step: 1 })],
    createNode: ({ id, field = 'input' }) => ({
      id,
      kind: 'field',
      material: 'element.input',
      field,
      label: 'Input',
      props: { placeholder: '' },
    }),
  },
  {
    key: 'element.textarea',
    version: 1,
    kind: 'field',
    title: 'Textarea',
    category: 'Fields',
    icon: AlignLeft,
    runtime: { component: ElInput },
    setters: [
      placeholderSetter,
      propSetter('rows', 'Rows', 'number', undefined, { min: 1, max: 20, step: 1 }),
      propSetter('maxlength', 'Max length', 'number', undefined, { min: 0, step: 1 }),
    ],
    createNode: ({ id, field = 'textarea' }) => ({
      id,
      kind: 'field',
      material: 'element.textarea',
      field,
      label: 'Textarea',
      props: { type: 'textarea', rows: 3, placeholder: '' },
    }),
  },
  {
    key: 'element.input-number',
    version: 1,
    kind: 'field',
    title: 'Number',
    category: 'Fields',
    icon: Hash,
    runtime: { component: ElInputNumber },
    setters: [
      propSetter('min', 'Minimum', 'number'),
      propSetter('max', 'Maximum', 'number'),
      propSetter('step', 'Step', 'number', undefined, { min: 0 }),
      propSetter('controls', 'Controls', 'boolean'),
    ],
    createNode: ({ id, field = 'number' }) => ({
      id,
      kind: 'field',
      material: 'element.input-number',
      field,
      label: 'Number',
      props: { step: 1, controls: true },
    }),
  },
  {
    key: 'element.select',
    version: 1,
    kind: 'field',
    title: 'Select',
    category: 'Choices',
    icon: List,
    runtime: { component: ElementSelectField },
    setters: [placeholderSetter, clearableSetter, propSetter('filterable', 'Filterable', 'boolean'), optionsSetter],
    createNode: ({ id, field = 'select' }) => ({
      id,
      kind: 'field',
      material: 'element.select',
      field,
      label: 'Select',
      props: { options: defaultOptions(), placeholder: '' },
    }),
  },
  {
    key: 'element.radio',
    version: 1,
    kind: 'field',
    title: 'Radio',
    category: 'Choices',
    icon: CircleDot,
    runtime: { component: ElementRadioField },
    setters: [optionsSetter, disabledSetter],
    createNode: ({ id, field = 'radio' }) => ({
      id,
      kind: 'field',
      material: 'element.radio',
      field,
      label: 'Radio',
      props: { options: defaultOptions() },
    }),
  },
  {
    key: 'element.checkbox',
    version: 1,
    kind: 'field',
    title: 'Checkbox',
    category: 'Choices',
    icon: CheckSquare,
    runtime: { component: ElementCheckboxField },
    setters: [optionsSetter, disabledSetter],
    createNode: ({ id, field = 'checkbox' }) => ({
      id,
      kind: 'field',
      material: 'element.checkbox',
      field,
      label: 'Checkbox',
      defaultValue: [],
      props: { options: defaultOptions() },
    }),
  },
  {
    key: 'element.switch',
    version: 1,
    kind: 'field',
    title: 'Switch',
    category: 'Choices',
    icon: ToggleLeft,
    runtime: { component: ElSwitch },
    setters: [propSetter('activeText', 'Active text', 'text'), propSetter('inactiveText', 'Inactive text', 'text')],
    createNode: ({ id, field = 'switch' }) => ({
      id,
      kind: 'field',
      material: 'element.switch',
      field,
      label: 'Switch',
      defaultValue: false,
    }),
  },
  {
    key: 'element.date',
    version: 1,
    kind: 'field',
    title: 'Date',
    category: 'Date & time',
    icon: Calendar,
    runtime: { component: ElDatePicker },
    setters: [placeholderSetter, clearableSetter, propSetter('format', 'Display format', 'text')],
    createNode: ({ id, field = 'date' }) => ({
      id,
      kind: 'field',
      material: 'element.date',
      field,
      label: 'Date',
      props: { type: 'date', valueFormat: 'YYYY-MM-DD', placeholder: '' },
    }),
  },
  {
    key: 'element.time',
    version: 1,
    kind: 'field',
    title: 'Time',
    category: 'Date & time',
    icon: Clock,
    runtime: { component: ElTimePicker },
    setters: [placeholderSetter, clearableSetter, propSetter('format', 'Display format', 'text')],
    createNode: ({ id, field = 'time' }) => ({
      id,
      kind: 'field',
      material: 'element.time',
      field,
      label: 'Time',
      props: { valueFormat: 'HH:mm:ss', placeholder: '' },
    }),
  },
  {
    key: 'element.section',
    version: 1,
    kind: 'container',
    title: 'Section',
    category: 'Layout',
    icon: LayoutPanelTop,
    runtime: { component: ElementSection },
    setters: [propSetter('title', 'Title', 'text'), propSetter('description', 'Description', 'textarea')],
    slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.section',
      props: { title: 'Section' },
      slots: { default: [] },
    }),
  },
  {
    key: 'element.card',
    version: 1,
    kind: 'container',
    title: 'Card',
    category: 'Layout',
    icon: Square,
    runtime: { component: ElCard },
    setters: [
      propSetter('header', 'Header', 'text'),
      propSetter('shadow', 'Shadow', 'select', [
        { label: 'Always', value: 'always' },
        { label: 'Hover', value: 'hover' },
        { label: 'Never', value: 'never' },
      ]),
    ],
    slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.card',
      props: { header: 'Card', shadow: 'never' },
      slots: { default: [] },
    }),
  },
  {
    key: 'element.tabs',
    version: 1,
    kind: 'container',
    title: 'Tabs',
    category: 'Layout',
    icon: PanelsTopLeft,
    runtime: { component: ElTabs },
    setters: [
      propSetter('tabPosition', 'Position', 'select', [
        { label: 'Top', value: 'top' },
        { label: 'Right', value: 'right' },
        { label: 'Bottom', value: 'bottom' },
        { label: 'Left', value: 'left' },
      ]),
      propSetter('stretch', 'Stretch', 'boolean'),
    ],
    slots: [{ name: 'default', title: 'Panes', accepts: ['container'], materials: ['element.tab-pane'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.tabs',
      props: { tabPosition: 'top' },
      slots: { default: [] },
    }),
  },
  {
    key: 'element.tab-pane',
    version: 1,
    kind: 'container',
    title: 'Tab pane',
    category: 'Layout',
    icon: PanelBottom,
    runtime: { component: ElTabPane },
    setters: [propSetter('label', 'Label', 'text'), propSetter('disabled', 'Disabled', 'boolean')],
    slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.tab-pane',
      props: { label: 'Tab', name: id },
      slots: { default: [] },
    }),
  },
  {
    key: 'element.collapse',
    version: 1,
    kind: 'container',
    title: 'Collapse',
    category: 'Layout',
    icon: ListCollapse,
    runtime: { component: ElCollapse },
    setters: [propSetter('accordion', 'Accordion', 'boolean')],
    slots: [{ name: 'default', title: 'Items', accepts: ['container'], materials: ['element.collapse-item'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.collapse',
      props: { accordion: false },
      slots: { default: [] },
    }),
  },
  {
    key: 'element.collapse-item',
    version: 1,
    kind: 'container',
    title: 'Collapse item',
    category: 'Layout',
    icon: PanelBottom,
    runtime: { component: ElCollapseItem },
    setters: [propSetter('title', 'Title', 'text'), propSetter('disabled', 'Disabled', 'boolean')],
    slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.collapse-item',
      props: { title: 'Item', name: id },
      slots: { default: [] },
    }),
  },
]
