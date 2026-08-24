import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'textarea',
  order: 20,
  value: {
    material: {
      key: 'element.textarea',
      version: 1,
      kind: 'field',
      title: 'Textarea',
      category: 'Fields',
      icon: shared.AlignLeft,
      runtime: { component: shared.ElInput, readonlyProp: 'readonly', readonlyRender: shared.renderElementPlusRawReadonly },
      setters: [
        shared.defaultValueSetter('text'),
        shared.placeholderSetter,
        shared.propSetter('rows', 'Rows', 'number', undefined, { min: 1, max: 20, step: 1 }),
        shared.propSetter('maxlength', 'Max length', 'number', undefined, { min: 0, step: 1 }),
      ],
      createNode: ({ id, field = 'textarea' }) => ({
        id,
        kind: 'field',
        material: 'element.textarea',
        field,
        label: 'Textarea',
        props: { type: 'textarea', rows: 3, placeholder: '' },
      }),
    },
    locale: { title: '多行输入', category: '字段', setters: { defaultValue: '默认值', placeholder: '占位文本', rows: '行数', maxlength: '最大长度' } },
  },
})
