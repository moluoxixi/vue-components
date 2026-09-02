import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'checkbox',
  order: 90,
  value: {
    material: {
      key: 'antd.checkbox',
      source: s.antdSource('select', 'a-checkbox-group', { options: { mode: 'prop' } }),
      version: 1,
      kind: 'field',
      title: 'Checkbox',
      category: 'Choices',
      icon: s.CheckSquare,
      runtime: {
        component: s.AntdCheckboxField,
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueChoiceReadonly,
      },
      analyze: s.createAntdVueOptionDiagnostics(),
      setters: [s.choiceDefaultValueSetter('multiselect'), s.optionSourceSetter, s.optionsSetter, s.disabledSetter],
      createNode: ({ id, field = 'checkbox' }) => ({
        id,
        kind: 'field',
        component: 'antd.checkbox',
        field,
        label: 'Checkbox',
        defaultValue: [],
        props: { options: s.defaultOptions() },
      }),
    },
    locale: {
      title: '复选框',
      category: '选择',
      setters: { defaultValue: '默认值', optionSource: '选项来源', options: '静态选项', disabled: '禁用' },
    },
  },
})
