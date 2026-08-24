import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'input',
  order: 10,
  value: {
    material: {
      key: 'element.input',
      version: 1,
      kind: 'field',
      title: 'Input',
      category: 'Fields',
      icon: shared.TypeIcon,
      runtime: { component: shared.ElInput, readonlyProp: 'readonly', readonlyRender: shared.renderElementPlusRawReadonly },
      setters: [shared.defaultValueSetter('text'), shared.placeholderSetter, shared.clearableSetter, shared.propSetter('maxlength', 'Max length', 'number', undefined, { min: 0, step: 1 })],
      createNode: ({ id, field = 'input' }) => ({
        id,
        kind: 'field',
        material: 'element.input',
        field,
        label: 'Input',
        props: { placeholder: '' },
      }),
    },
    locale: { title: '输入框', category: '字段', setters: { defaultValue: '默认值', placeholder: '占位文本', clearable: '可清空', maxlength: '最大长度' } },
  },
})
