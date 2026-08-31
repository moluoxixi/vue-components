import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'select',
  order: 60,
  value: {
    material: {
      key: 'antd.select',
      source: s.antdSource('select', 'a-select', { options: { mode: 'prop' } }),
      version: 1,
      kind: 'field',
      title: 'Select',
      category: 'Choices',
      icon: s.List,
      runtime: {
        component: s.AntdSelectField,
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
        s.propSetter('showSearch', 'Searchable', 'boolean'),
      ],
      createNode: ({ id, field = 'select' }) => ({
        id,
        kind: 'field',
        component: 'antd.select',
        field,
        label: 'Select',
        props: { options: s.defaultOptions(), placeholder: '' },
      }),
    },
    locale: {
      title: '选择器',
      category: '选择',
      setters: {
        defaultValue: '默认值',
        optionSource: '选项来源',
        options: '静态选项',
        placeholder: '占位文本',
        allowClear: '可清空',
        showSearch: '可搜索',
      },
    },
  },
})
