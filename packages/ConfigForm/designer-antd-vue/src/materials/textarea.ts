import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'textarea',
  order: 40,
  value: {
    material: {
      key: 'antd.textarea',
      source: s.antdSource('textarea', 'a-textarea'),
      version: 1,
      kind: 'field',
      title: 'Textarea',
      category: 'Fields',
      icon: s.AlignLeft,
      runtime: {
        component: s.Input.TextArea,
        ...s.valueBinding,
        readonlyProp: 'readonly',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      setters: [
        s.defaultValueSetter('text'),
        s.placeholderSetter,
        s.propSetter('rows', 'Rows', 'number', undefined, { min: 1, max: 20, step: 1 }),
        s.propSetter('maxlength', 'Max length', 'number', undefined, { min: 0, step: 1 }),
      ],
      createNode: ({ id, field = 'textarea' }) => ({
        id,
        kind: 'field',
        material: 'antd.textarea',
        field,
        label: 'Textarea',
        props: { rows: 3, placeholder: '' },
      }),
    },
    locale: {
      title: '多行输入',
      category: '字段',
      setters: { defaultValue: '默认值', placeholder: '占位文本', rows: '行数', maxlength: '最大长度' },
    },
  },
})
