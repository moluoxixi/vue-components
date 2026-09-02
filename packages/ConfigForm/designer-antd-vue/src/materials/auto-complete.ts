import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'auto-complete',
  order: 70,
  value: {
    material: {
      key: 'antd.auto-complete',
      source: s.antdSource('text', 'a-auto-complete', { options: { mode: 'prop' } }),
      version: 1,
      kind: 'field',
      title: 'Autocomplete',
      category: 'Choices',
      icon: s.TextCursorInput,
      runtime: {
        component: s.AntdAutoCompleteField,
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueChoiceReadonly,
      },
      analyze: s.createAntdVueOptionDiagnostics(),
      setters: [
        s.choiceDefaultValueSetter('select'),
        s.optionSourceSetter,
        s.optionsSetter,
        s.placeholderSetter,
        s.allowClearSetter,
      ],
      createNode: ({ id, field = 'autoComplete' }) => ({
        id,
        kind: 'field',
        component: 'antd.auto-complete',
        field,
        label: 'Autocomplete',
        props: { options: s.defaultOptions(), placeholder: '' },
      }),
    },
    locale: {
      title: '自动完成',
      category: '选择',
      setters: {
        defaultValue: '默认值',
        optionSource: '选项来源',
        options: '静态选项',
        placeholder: '占位文本',
        allowClear: '可清空',
      },
    },
  },
})
