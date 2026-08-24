import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'radio',
  order: 50,
  value: {
    material: {
      key: 'element.radio',
      version: 1,
      kind: 'field',
      title: 'Radio',
      category: 'Choices',
      icon: shared.CircleDot,
      runtime: { component: shared.ElementRadioField, readonlyProp: 'disabled', readonlyRender: shared.renderElementPlusChoiceReadonly },
      analyze: shared.createElementPlusOptionDiagnostics(),
      setters: [shared.choiceDefaultValueSetter('select'), shared.optionSourceSetter, shared.optionsSetter, shared.disabledSetter],
      createNode: ({ id, field = 'radio' }) => ({
        id,
        kind: 'field',
        material: 'element.radio',
        field,
        label: 'Radio',
        props: { options: shared.defaultOptions() },
      }),
    },
    locale: { title: '单选框', category: '选择', setters: { defaultValue: '默认值', optionSource: '选项来源', options: '静态选项', disabled: '禁用' } },
  },
})
