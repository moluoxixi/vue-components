import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'password',
  order: 20,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'antd.password',
      source: s.antdSource('text', 'a-input-password'),
      title: 'Password',
      category: 'Fields',
      icon: s.KeyRound,
      component: s.Input.Password,
      runtime: {
        ...s.valueBinding,
        readonlyProp: 'readonly',
        readonlyRender: s.renderAntdVuePasswordReadonly,
      },
      value: { kind: 'text' },
      props: {
        placeholder: { label: 'Placeholder', control: 'text', default: '' },
        allowClear: { label: 'Allow clear', control: 'boolean' },
        visibilityToggle: { label: 'Visibility toggle', control: 'boolean', default: true },
        maxlength: { label: 'Max length', control: 'number', min: 0, step: 1 },
      },
    }),
    locale: {
      title: '密码框',
      category: '字段',
      setters: {
        defaultValue: '默认值',
        placeholder: '占位文本',
        allowClear: '可清空',
        visibilityToggle: '显示切换',
        maxlength: '最大长度',
      },
    },
  },
})
