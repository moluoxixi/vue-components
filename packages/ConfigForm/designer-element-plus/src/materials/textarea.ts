import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'textarea',
  order: 20,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'element.textarea',
      source: shared.elementSource('textarea', 'el-input', { staticProps: { type: 'textarea' } }),
      title: 'Textarea',
      category: 'Fields',
      icon: shared.AlignLeft,
      component: shared.ElInput,
      runtime: { readonlyProp: 'readonly', readonlyRender: shared.renderElementPlusRawReadonly },
      value: { kind: 'text' },
      defaultProps: { type: 'textarea' },
      props: {
        placeholder: { label: 'Placeholder', control: 'text', default: '' },
        rows: { label: 'Rows', control: 'number', default: 3, min: 1, max: 20, step: 1 },
        maxlength: { label: 'Max length', control: 'number', min: 0, step: 1 },
      },
    }),
    locale: { title: '多行输入', category: '字段', setters: { defaultValue: '默认值', placeholder: '占位文本', rows: '行数', maxlength: '最大长度' } },
  },
})
