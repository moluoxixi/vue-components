import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'checkbox',
  order: 60,
  value: {
    material: {
      key: 'element.checkbox',
      source: shared.elementSource('select', 'el-checkbox-group', {
        options: { mode: 'children', optionTag: 'el-checkbox', labelProp: 'label', valueProp: 'value' },
      }),
      version: 1,
      kind: 'field',
      title: 'Checkbox',
      category: 'Choices',
      icon: shared.CheckSquare,
      runtime: { component: shared.ElementCheckboxField, readonlyProp: 'disabled', readonlyRender: shared.renderElementPlusChoiceReadonly },
      analyze: shared.createElementPlusOptionDiagnostics(),
      setters: [shared.choiceDefaultValueSetter('multiselect'), shared.optionSourceSetter, shared.optionsSetter, shared.disabledSetter],
      createNode: ({ id, field = 'checkbox' }) => ({
        id,
        kind: 'field',
        component: 'element.checkbox',
        field,
        label: 'Checkbox',
        defaultValue: [],
        props: { options: shared.defaultOptions() },
      }),
    },
    locale: { title: '复选框', category: '选择', setters: { defaultValue: '默认值', optionSource: '选项来源', options: '静态选项', disabled: '禁用' } },
  },
})
