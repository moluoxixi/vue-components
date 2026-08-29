import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'radio',
  order: 80,
  value: {
    material: {
      key: 'antd.radio',
      source: s.antdSource('select', 'a-radio-group', { options: { mode: 'prop' } }),
      version: 1,
      kind: 'field',
      title: 'Radio',
      category: 'Choices',
      icon: s.CircleDot,
      runtime: {
        component: s.AntdRadioField,
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueChoiceReadonly,
      },
      analyze: s.createAntdVueOptionDiagnostics(),
      setters: [s.choiceDefaultValueSetter('select'), s.optionSourceSetter, s.optionsSetter, s.disabledSetter],
      createNode: ({ id, field = 'radio' }) => ({
        id,
        kind: 'field',
        material: 'antd.radio',
        field,
        label: 'Radio',
        props: { options: s.defaultOptions() },
      }),
    },
    locale: {
      title: '单选框',
      category: '选择',
      setters: { defaultValue: '默认值', optionSource: '选项来源', options: '静态选项', disabled: '禁用' },
    },
  },
})
