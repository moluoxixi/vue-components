import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'password',
  order: 20,
  value: {
    material: {
      key: 'antd.password',
      source: s.antdSource('text', 'a-input-password'),
      version: 1,
      kind: 'field',
      title: 'Password',
      category: 'Fields',
      icon: s.KeyRound,
      runtime: {
        component: s.Input.Password,
        ...s.valueBinding,
        readonlyProp: 'readonly',
        readonlyRender: s.renderAntdVuePasswordReadonly,
      },
      setters: [
        s.defaultValueSetter('text'),
        s.placeholderSetter,
        s.allowClearSetter,
        s.propSetter('visibilityToggle', 'Visibility toggle', 'boolean'),
        s.propSetter('maxlength', 'Max length', 'number', undefined, { min: 0, step: 1 }),
      ],
      createNode: ({ id, field = 'password' }) => ({
        id,
        kind: 'field',
        component: 'antd.password',
        field,
        label: 'Password',
        props: { placeholder: '', visibilityToggle: true },
      }),
    },
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
