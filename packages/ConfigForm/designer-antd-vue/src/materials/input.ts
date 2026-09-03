import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'input',
  order: 10,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'antd.input',
      source: s.antdSource('text', 'a-input'),
      title: 'Input',
      category: 'Fields',
      icon: s.TypeIcon,
      component: s.Input,
      runtime: {
        ...s.valueBinding,
        readonlyProp: 'readonly',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      value: { kind: 'text' },
      props: {
        placeholder: { label: 'Placeholder', control: 'text', default: '' },
        allowClear: { label: 'Allow clear', control: 'boolean' },
        maxlength: { label: 'Max length', control: 'number', min: 0, step: 1 },
      },
    }),
    locale: {
      title: '输入框',
      category: '字段',
      setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', maxlength: '最大长度' },
    },
  },
})
