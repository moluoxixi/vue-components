import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'input',
  order: 10,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'element.input',
      source: shared.elementSource('text', 'el-input'),
      title: 'Input',
      category: 'Fields',
      icon: shared.TypeIcon,
      component: shared.ElInput,
      runtime: { readonlyProp: 'readonly', readonlyRender: shared.renderElementPlusRawReadonly },
      value: { kind: 'text' },
      props: {
        placeholder: { label: 'Placeholder', control: 'text', default: '' },
        clearable: { label: 'Clearable', control: 'boolean' },
        maxlength: { label: 'Max length', control: 'number', min: 0, step: 1 },
      },
    }),
    locale: { title: '输入框', category: '字段', setters: { defaultValue: '默认值', placeholder: '占位文本', clearable: '可清空', maxlength: '最大长度' } },
  },
})
