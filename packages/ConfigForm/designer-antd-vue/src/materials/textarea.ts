import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'textarea',
  order: 40,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'antd.textarea',
      source: s.antdSource('textarea', 'a-textarea'),
      title: 'Textarea',
      category: 'Fields',
      icon: s.AlignLeft,
      component: s.Input.TextArea,
      runtime: {
        ...s.valueBinding,
        readonlyProp: 'readonly',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      value: { kind: 'text' },
      props: {
        placeholder: { label: 'Placeholder', control: 'text', default: '' },
        rows: { label: 'Rows', control: 'number', default: 3, min: 1, max: 20, step: 1 },
        maxlength: { label: 'Max length', control: 'number', min: 0, step: 1 },
      },
    }),
    locale: {
      title: '多行输入',
      category: '字段',
      setters: { defaultValue: '默认值', placeholder: '占位文本', rows: '行数', maxlength: '最大长度' },
    },
  },
})
