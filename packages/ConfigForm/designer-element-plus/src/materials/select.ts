import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'select',
  order: 40,
  value: {
    material: {
      key: 'element.select',
      source: shared.elementSource('select', 'el-select', {
        options: { mode: 'children', optionTag: 'el-option', labelProp: 'label', valueProp: 'value' },
      }),
      version: 1,
      kind: 'field',
      title: 'Select',
      category: 'Choices',
      icon: shared.List,
      runtime: { component: shared.ElementSelectField, readonlyProp: 'disabled', readonlyRender: shared.renderElementPlusChoiceReadonly },
      analyze: shared.createElementPlusOptionDiagnostics(),
      setters: [shared.choiceDefaultValueSetter('select'), shared.optionSourceSetter, shared.optionsSetter, shared.placeholderSetter, shared.clearableSetter, shared.propSetter('filterable', 'Filterable', 'boolean')],
      createNode: ({ id, field = 'select' }) => ({
        id,
        kind: 'field',
        material: 'element.select',
        field,
        label: 'Select',
        props: { options: shared.defaultOptions(), placeholder: '' },
      }),
    },
    locale: { title: '选择器', category: '选择', setters: { defaultValue: '默认值', optionSource: '选项来源', placeholder: '占位文本', clearable: '可清空', filterable: '可筛选', options: '静态选项' } },
  },
})
