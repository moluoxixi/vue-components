import type {
  DesignerDefaultValueKind,
  DesignerLocaleOptions,
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
import {
  AntdCollapseItemPreview,
  AntdCollapsePreview,
  AntdTabPanePreview,
  AntdTabsPreview,
} from './components/AntdStructuralPreview'
import AntdFlexLayout from './layout/AntdFlexLayout.vue'
import AntdGridLayout from './layout/AntdGridLayout.vue'
import { createAntdVueOptionDiagnostics } from './options'
import {
  renderAntdVueChoiceReadonly,
  renderAntdVuePasswordReadonly,
  renderAntdVueRawReadonly,
  renderAntdVueSwitchReadonly,
} from './readonly'

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

function defaultValueSetter(valueKind: DesignerDefaultValueKind): DesignerPropertySetterDefinition {
  return {
    key: 'defaultValue',
    label: 'Default value',
    path: ['defaultValue'],
    control: 'defaultValue',
    valueKind,
  }
}

const placeholderSetter = propSetter('placeholder', 'Placeholder', 'text')
const allowClearSetter = propSetter('allowClear', 'Allow clear', 'boolean')
const disabledSetter = propSetter('disabled', 'Disabled', 'boolean')
const optionsSetter = propSetter('options', 'Static options', 'options')
const optionSourceSetter: DesignerPropertySetterDefinition = {
  key: 'optionSource',
  label: 'Option source',
  path: ['props', 'optionSource'],
  control: 'custom',
  component: AntdOptionSourceSetter,
}
const optionDefaults = [
  { label: 'Option A', value: 'a' },
  { label: 'Option B', value: 'b' },
]

function defaultOptions(): typeof optionDefaults {
  return optionDefaults.map(option => ({ ...option }))
}

function choiceDefaultValueSetter(
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

const valueBinding = { valueProp: 'value', trigger: 'update:value' }
const checkedBinding = { valueProp: 'checked', trigger: 'update:checked' }

export const ANTD_VUE_DESIGNER_MATERIALS: DesignerMaterialDefinition[] = [
  {
    key: 'antd.input',
    version: 1,
    kind: 'field',
    title: 'Input',
    category: 'Fields',
    icon: TypeIcon,
    runtime: { component: Input, ...valueBinding, readonlyProp: 'readonly', readonlyRender: renderAntdVueRawReadonly },
    setters: [defaultValueSetter('text'), placeholderSetter, allowClearSetter, propSetter('maxlength', 'Max length', 'number', undefined, { min: 0, step: 1 })],
    createNode: ({ id, field = 'input' }) => ({
      id,
      kind: 'field',
      material: 'antd.input',
      field,
      label: 'Input',
      props: { placeholder: '' },
    }),
  },
  {
    key: 'antd.password',
    version: 1,
    kind: 'field',
    title: 'Password',
    category: 'Fields',
    icon: KeyRound,
    runtime: { component: Input.Password, ...valueBinding, readonlyProp: 'readonly', readonlyRender: renderAntdVuePasswordReadonly },
    setters: [defaultValueSetter('text'), placeholderSetter, allowClearSetter, propSetter('visibilityToggle', 'Visibility toggle', 'boolean'), propSetter('maxlength', 'Max length', 'number', undefined, { min: 0, step: 1 })],
    createNode: ({ id, field = 'password' }) => ({
      id,
      kind: 'field',
      material: 'antd.password',
      field,
      label: 'Password',
      props: { placeholder: '', visibilityToggle: true },
    }),
  },
  {
    key: 'antd.search',
    version: 1,
    kind: 'field',
    title: 'Search',
    category: 'Fields',
    icon: SearchIcon,
    runtime: { component: Input.Search, ...valueBinding, readonlyProp: 'readonly', readonlyRender: renderAntdVueRawReadonly },
    setters: [defaultValueSetter('text'), placeholderSetter, allowClearSetter, propSetter('enterButton', 'Search button', 'boolean')],
    createNode: ({ id, field = 'search' }) => ({
      id,
      kind: 'field',
      material: 'antd.search',
      field,
      label: 'Search',
      props: { placeholder: '', enterButton: false },
    }),
  },
  {
    key: 'antd.textarea',
    version: 1,
    kind: 'field',
    title: 'Textarea',
    category: 'Fields',
    icon: AlignLeft,
    runtime: { component: Input.TextArea, ...valueBinding, readonlyProp: 'readonly', readonlyRender: renderAntdVueRawReadonly },
    setters: [
      defaultValueSetter('text'),
      placeholderSetter,
      propSetter('rows', 'Rows', 'number', undefined, { min: 1, max: 20, step: 1 }),
      propSetter('maxlength', 'Max length', 'number', undefined, { min: 0, step: 1 }),
    ],
    createNode: ({ id, field = 'textarea' }) => ({
      id,
      kind: 'field',
      material: 'antd.textarea',
      field,
      label: 'Textarea',
      props: { rows: 3, placeholder: '' },
    }),
  },
  {
    key: 'antd.input-number',
    version: 1,
    kind: 'field',
    title: 'Number',
    category: 'Fields',
    icon: Hash,
    runtime: { component: InputNumber, ...valueBinding, readonlyProp: 'disabled', readonlyRender: renderAntdVueRawReadonly },
    setters: [
      defaultValueSetter('number'),
      propSetter('min', 'Minimum', 'number'),
      propSetter('max', 'Maximum', 'number'),
      propSetter('step', 'Step', 'number', undefined, { min: 0 }),
      propSetter('controls', 'Controls', 'boolean'),
    ],
    createNode: ({ id, field = 'number' }) => ({
      id,
      kind: 'field',
      material: 'antd.input-number',
      field,
      label: 'Number',
      props: { step: 1, controls: true },
    }),
  },
  {
    key: 'antd.select',
    version: 1,
    kind: 'field',
    title: 'Select',
    category: 'Choices',
    icon: List,
    runtime: { component: AntdSelectField, ...valueBinding, readonlyProp: 'disabled', readonlyRender: renderAntdVueChoiceReadonly },
    analyze: createAntdVueOptionDiagnostics(),
    setters: [choiceDefaultValueSetter('select'), optionSourceSetter, optionsSetter, placeholderSetter, allowClearSetter, propSetter('showSearch', 'Searchable', 'boolean')],
    createNode: ({ id, field = 'select' }) => ({
      id,
      kind: 'field',
      material: 'antd.select',
      field,
      label: 'Select',
      props: { options: defaultOptions(), placeholder: '' },
    }),
  },
  {
    key: 'antd.auto-complete',
    version: 1,
    kind: 'field',
    title: 'Autocomplete',
    category: 'Choices',
    icon: TextCursorInput,
    runtime: { component: AntdAutoCompleteField, ...valueBinding, readonlyProp: 'disabled', readonlyRender: renderAntdVueChoiceReadonly },
    analyze: createAntdVueOptionDiagnostics(),
    setters: [choiceDefaultValueSetter('select'), optionSourceSetter, optionsSetter, placeholderSetter, allowClearSetter],
    createNode: ({ id, field = 'autoComplete' }) => ({
      id,
      kind: 'field',
      material: 'antd.auto-complete',
      field,
      label: 'Autocomplete',
      props: { options: defaultOptions(), placeholder: '' },
    }),
  },
  {
    key: 'antd.radio',
    version: 1,
    kind: 'field',
    title: 'Radio',
    category: 'Choices',
    icon: CircleDot,
    runtime: { component: AntdRadioField, ...valueBinding, readonlyProp: 'disabled', readonlyRender: renderAntdVueChoiceReadonly },
    analyze: createAntdVueOptionDiagnostics(),
    setters: [choiceDefaultValueSetter('select'), optionSourceSetter, optionsSetter, disabledSetter],
    createNode: ({ id, field = 'radio' }) => ({
      id,
      kind: 'field',
      material: 'antd.radio',
      field,
      label: 'Radio',
      props: { options: defaultOptions() },
    }),
  },
  {
    key: 'antd.checkbox',
    version: 1,
    kind: 'field',
    title: 'Checkbox',
    category: 'Choices',
    icon: CheckSquare,
    runtime: { component: AntdCheckboxField, ...valueBinding, readonlyProp: 'disabled', readonlyRender: renderAntdVueChoiceReadonly },
    analyze: createAntdVueOptionDiagnostics(),
    setters: [choiceDefaultValueSetter('multiselect'), optionSourceSetter, optionsSetter, disabledSetter],
    createNode: ({ id, field = 'checkbox' }) => ({
      id,
      kind: 'field',
      material: 'antd.checkbox',
      field,
      label: 'Checkbox',
      defaultValue: [],
      props: { options: defaultOptions() },
    }),
  },
  {
    key: 'antd.switch',
    version: 1,
    kind: 'field',
    title: 'Switch',
    category: 'Choices',
    icon: ToggleLeft,
    runtime: { component: Switch, ...checkedBinding, readonlyProp: 'disabled', readonlyRender: renderAntdVueSwitchReadonly },
    setters: [defaultValueSetter('boolean'), propSetter('checkedChildren', 'Checked text', 'text'), propSetter('unCheckedChildren', 'Unchecked text', 'text')],
    createNode: ({ id, field = 'switch' }) => ({
      id,
      kind: 'field',
      material: 'antd.switch',
      field,
      label: 'Switch',
      defaultValue: false,
    }),
  },
  {
    key: 'antd.slider',
    version: 1,
    kind: 'field',
    title: 'Slider',
    category: 'Choices',
    icon: SlidersHorizontal,
    runtime: { component: Slider, ...valueBinding, readonlyProp: 'disabled', readonlyRender: renderAntdVueRawReadonly },
    setters: [defaultValueSetter('number'), propSetter('min', 'Minimum', 'number'), propSetter('max', 'Maximum', 'number'), propSetter('step', 'Step', 'number', undefined, { min: 0 })],
    createNode: ({ id, field = 'slider' }) => ({
      id,
      kind: 'field',
      material: 'antd.slider',
      field,
      label: 'Slider',
      defaultValue: 0,
      props: { min: 0, max: 100, step: 1 },
    }),
  },
  {
    key: 'antd.rate',
    version: 1,
    kind: 'field',
    title: 'Rate',
    category: 'Choices',
    icon: Star,
    runtime: { component: Rate, ...valueBinding, readonlyProp: 'disabled', readonlyRender: renderAntdVueRawReadonly },
    setters: [defaultValueSetter('number'), propSetter('count', 'Count', 'number', undefined, { min: 1, max: 10, step: 1 }), propSetter('allowHalf', 'Allow half', 'boolean'), allowClearSetter],
    createNode: ({ id, field = 'rate' }) => ({
      id,
      kind: 'field',
      material: 'antd.rate',
      field,
      label: 'Rate',
      defaultValue: 0,
      props: { count: 5, allowHalf: false, allowClear: true },
    }),
  },
  {
    key: 'antd.date',
    version: 1,
    kind: 'field',
    title: 'Date',
    category: 'Date & time',
    icon: Calendar,
    runtime: { component: DatePicker, ...valueBinding, readonlyProp: 'disabled', readonlyRender: renderAntdVueRawReadonly },
    setters: [defaultValueSetter('date'), placeholderSetter, allowClearSetter, propSetter('format', 'Display format', 'text')],
    createNode: ({ id, field = 'date' }) => ({
      id,
      kind: 'field',
      material: 'antd.date',
      field,
      label: 'Date',
      props: { valueFormat: 'YYYY-MM-DD', placeholder: '' },
    }),
  },
  {
    key: 'antd.time',
    version: 1,
    kind: 'field',
    title: 'Time',
    category: 'Date & time',
    icon: Clock,
    runtime: { component: TimePicker, ...valueBinding, readonlyProp: 'disabled', readonlyRender: renderAntdVueRawReadonly },
    setters: [defaultValueSetter('time'), placeholderSetter, allowClearSetter, propSetter('format', 'Display format', 'text')],
    createNode: ({ id, field = 'time' }) => ({
      id,
      kind: 'field',
      material: 'antd.time',
      field,
      label: 'Time',
      props: { valueFormat: 'HH:mm:ss', placeholder: '' },
    }),
  },
  {
    key: 'antd.section',
    version: 1,
    kind: 'container',
    title: 'Section',
    category: 'Layout',
    icon: LayoutPanelTop,
    runtime: { component: AntdSection },
    setters: [propSetter('title', 'Title', 'text'), propSetter('description', 'Description', 'textarea')],
    slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'antd.section',
      props: { title: 'Section' },
      slots: { default: [] },
    }),
  },
  {
    key: 'antd.card',
    version: 1,
    kind: 'container',
    title: 'Card',
    category: 'Layout',
    icon: Square,
    runtime: { component: Card },
    setters: [propSetter('title', 'Title', 'text'), propSetter('bordered', 'Bordered', 'boolean')],
    slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'antd.card',
      props: { title: 'Card', bordered: true },
      slots: { default: [] },
    }),
  },
  {
    key: 'antd.tabs',
    version: 1,
    kind: 'container',
    title: 'Tabs',
    category: 'Layout',
    icon: PanelsTopLeft,
    runtime: { component: Tabs, designerComponent: AntdTabsPreview },
    setters: [
      propSetter('tabPosition', 'Position', 'select', [
        { label: 'Top', value: 'top' },
        { label: 'Right', value: 'right' },
        { label: 'Bottom', value: 'bottom' },
        { label: 'Left', value: 'left' },
      ]),
      propSetter('centered', 'Centered', 'boolean'),
    ],
    slots: [{ name: 'default', title: 'Panes', accepts: ['container'], materials: ['antd.tab-pane'] }],
    createNode: ({ id }) => {
      const paneId = `${id}-pane-1`
      return {
        id,
        kind: 'container',
        material: 'antd.tabs',
        props: { tabPosition: 'top', activeKey: paneId },
        slots: {
          default: [{
            id: paneId,
            kind: 'container',
            material: 'antd.tab-pane',
            props: { tab: 'Tab 1', key: paneId },
            slots: { default: [] },
          }],
        },
      }
    },
  },
  {
    key: 'antd.tab-pane',
    version: 1,
    kind: 'container',
    title: 'Tab pane',
    category: 'Layout',
    icon: PanelBottom,
    runtime: { component: TabPane, designerComponent: AntdTabPanePreview },
    setters: [propSetter('tab', 'Label', 'text'), propSetter('disabled', 'Disabled', 'boolean')],
    slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'antd.tab-pane',
      props: { tab: 'Tab', key: id },
      slots: { default: [] },
    }),
  },
  {
    key: 'antd.collapse',
    version: 1,
    kind: 'container',
    title: 'Collapse',
    category: 'Layout',
    icon: ListCollapse,
    runtime: { component: Collapse, designerComponent: AntdCollapsePreview },
    setters: [propSetter('accordion', 'Accordion', 'boolean')],
    slots: [{ name: 'default', title: 'Items', accepts: ['container'], materials: ['antd.collapse-item'] }],
    createNode: ({ id }) => {
      const itemId = `${id}-item-1`
      return {
        id,
        kind: 'container',
        material: 'antd.collapse',
        props: { accordion: false, activeKey: [itemId] },
        slots: {
          default: [{
            id: itemId,
            kind: 'container',
            material: 'antd.collapse-item',
            props: { header: 'Item 1', key: itemId },
            slots: { default: [] },
          }],
        },
      }
    },
  },
  {
    key: 'antd.collapse-item',
    version: 1,
    kind: 'container',
    title: 'Collapse item',
    category: 'Layout',
    icon: PanelBottom,
    runtime: { component: CollapsePanel, designerComponent: AntdCollapseItemPreview },
    setters: [propSetter('header', 'Title', 'text'), propSetter('disabled', 'Disabled', 'boolean')],
    slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'antd.collapse-item',
      props: { header: 'Item', key: id },
      slots: { default: [] },
    }),
  },
  {
    key: 'antd.flex',
    version: 1,
    kind: 'container',
    title: 'Flex Wrap',
    category: 'Layout',
    icon: Rows3,
    runtime: { component: AntdFlexLayout },
    setters: [
      propSetter('direction', 'Direction', 'select', [
        { label: 'Row', value: 'row' },
        { label: 'Column', value: 'column' },
      ]),
      propSetter('wrap', 'Wrap', 'boolean'),
      propSetter('justify', 'Justify', 'select', [
        { label: 'Start', value: 'flex-start' },
        { label: 'Center', value: 'center' },
        { label: 'End', value: 'flex-end' },
        { label: 'Between', value: 'space-between' },
      ]),
      propSetter('align', 'Align', 'select', [
        { label: 'Start', value: 'flex-start' },
        { label: 'Center', value: 'center' },
        { label: 'End', value: 'flex-end' },
        { label: 'Stretch', value: 'stretch' },
      ]),
      propSetter('gap', 'Gap', 'number', undefined, { min: 0, max: 64, step: 4 }),
      propSetter('itemWidth', 'Item width', 'number', undefined, { min: 80, max: 600, step: 20 }),
    ],
    slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'antd.flex',
      props: { direction: 'row', wrap: true, gap: 12, justify: 'flex-start', align: 'stretch', itemWidth: 220 },
      slots: { default: [] },
    }),
  },
  {
    key: 'antd.grid',
    version: 1,
    kind: 'container',
    title: 'Grid',
    category: 'Layout',
    icon: LayoutGrid,
    runtime: { component: AntdGridLayout },
    setters: [
      propSetter('columns', 'Columns', 'number', undefined, { min: 1, max: 12, step: 1 }),
      propSetter('gap', 'Gap', 'number', undefined, { min: 0, max: 64, step: 4 }),
    ],
    slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'antd.grid',
      props: { columns: 2, gap: 12 },
      slots: { default: [] },
    }),
  },
]

export const ANTD_VUE_DESIGNER_ZH_CN: DesignerLocaleOptions = {
  locale: 'zh-CN',
  materials: {
    'antd.input': { title: '输入框', category: '字段', setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', maxlength: '最大长度' } },
    'antd.password': { title: '密码框', category: '字段', setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', visibilityToggle: '显示切换', maxlength: '最大长度' } },
    'antd.search': { title: '搜索框', category: '字段', setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', enterButton: '搜索按钮' } },
    'antd.textarea': { title: '多行输入', category: '字段', setters: { defaultValue: '默认值', placeholder: '占位文本', rows: '行数', maxlength: '最大长度' } },
    'antd.input-number': { title: '数字输入', category: '字段', setters: { defaultValue: '默认值', min: '最小值', max: '最大值', step: '步长', controls: '显示控件' } },
    'antd.select': { title: '选择器', category: '选择', setters: { defaultValue: '默认值', optionSource: '选项来源', options: '静态选项', placeholder: '占位文本', allowClear: '可清空', showSearch: '可搜索' } },
    'antd.auto-complete': { title: '自动完成', category: '选择', setters: { defaultValue: '默认值', optionSource: '选项来源', options: '静态选项', placeholder: '占位文本', allowClear: '可清空' } },
    'antd.radio': { title: '单选框', category: '选择', setters: { defaultValue: '默认值', optionSource: '选项来源', options: '静态选项', disabled: '禁用' } },
    'antd.checkbox': { title: '复选框', category: '选择', setters: { defaultValue: '默认值', optionSource: '选项来源', options: '静态选项', disabled: '禁用' } },
    'antd.switch': { title: '开关', category: '选择', setters: { defaultValue: '默认值', checkedChildren: '开启文案', unCheckedChildren: '关闭文案' } },
    'antd.slider': { title: '滑块', category: '选择', setters: { defaultValue: '默认值', min: '最小值', max: '最大值', step: '步长' } },
    'antd.rate': { title: '评分', category: '选择', setters: { defaultValue: '默认值', count: '数量', allowHalf: '允许半选', allowClear: '可清空' } },
    'antd.date': { title: '日期', category: '日期时间', setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', format: '显示格式' } },
    'antd.time': { title: '时间', category: '日期时间', setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', format: '显示格式' } },
    'antd.section': { title: '分区', category: '布局', setters: { title: '标题', description: '描述' }, slots: { default: '内容' } },
    'antd.card': { title: '卡片', category: '布局', setters: { title: '标题', bordered: '显示边框' }, slots: { default: '内容' } },
    'antd.tabs': { title: '标签页', category: '布局', setters: { tabPosition: '位置', centered: '居中' }, options: { tabPosition: { top: '顶部', right: '右侧', bottom: '底部', left: '左侧' } }, slots: { default: '面板' } },
    'antd.tab-pane': { title: '标签面板', category: '布局', setters: { tab: '标签', disabled: '禁用' }, slots: { default: '内容' } },
    'antd.collapse': { title: '折叠面板', category: '布局', setters: { accordion: '手风琴模式' }, slots: { default: '面板项' } },
    'antd.collapse-item': { title: '折叠项', category: '布局', setters: { header: '标题', disabled: '禁用' }, slots: { default: '内容' } },
    'antd.flex': {
      title: 'Flex 换行',
      category: '布局',
      setters: { direction: '方向', wrap: '换行', justify: '主轴对齐', align: '交叉轴对齐', gap: '间距', itemWidth: '项目宽度' },
      options: {
        direction: { row: '横向', column: '纵向' },
        justify: { 'flex-start': '起始', 'center': '居中', 'flex-end': '结束', 'space-between': '两端' },
        align: { 'flex-start': '起始', 'center': '居中', 'flex-end': '结束', 'stretch': '拉伸' },
      },
      slots: { default: '内容' },
    },
    'antd.grid': { title: 'Grid 栅格', category: '布局', setters: { columns: '列数', gap: '间距' }, slots: { default: '内容' } },
  },
}
