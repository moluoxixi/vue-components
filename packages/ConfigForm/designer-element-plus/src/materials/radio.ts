import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'radio',
  order: 50,
  value: {
    material: {
      key: 'element.radio',
      source: shared.elementSource('select', 'el-radio-group', {
        options: { mode: 'children', optionTag: 'el-radio', labelProp: 'label', valueProp: 'value' },
      }),
      version: 1,
      kind: 'field',
      title: 'Radio',
      category: 'Choices',
      icon: shared.CircleDot,
      runtime: { component: shared.ElementRadioField, readonlyProp: 'disabled', readonlyRender: shared.renderElementPlusChoiceReadonly },
      setters: [
        shared.choiceDefaultValueSetter('select', shared.DESIGNER_OPTION_VALUE_TYPES),
        shared.optionsSetter(shared.DESIGNER_OPTION_VALUE_TYPES),
        shared.disabledSetter,
      ],
      createNode: ({ id, field = 'radio' }) => ({
        id,
        kind: 'field',
        component: 'element.radio',
        field,
        label: 'Radio',
        props: { options: shared.defaultOptions() },
      }),
    },
    locale: { title: '单选框', category: '选择', setters: { defaultValue: '默认值', options: '静态选项', disabled: '禁用' } },
  },
})
