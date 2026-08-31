import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'input',
  order: 10,
  value: {
    material: {
      key: 'antd.input',
      source: s.antdSource('text', 'a-input'),
      version: 1,
      kind: 'field',
      title: 'Input',
      category: 'Fields',
      icon: s.TypeIcon,
      runtime: {
        component: s.Input,
        ...s.valueBinding,
        readonlyProp: 'readonly',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      setters: [
        s.defaultValueSetter('text'),
        s.placeholderSetter,
        s.allowClearSetter,
        s.propSetter('maxlength', 'Max length', 'number', undefined, { min: 0, step: 1 }),
      ],
      createNode: ({ id, field = 'input' }) => ({
        id,
        kind: 'field',
        component: 'antd.input',
        field,
        label: 'Input',
        props: { placeholder: '' },
      }),
    },
    locale: {
      title: '输入框',
      category: '字段',
      setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', maxlength: '最大长度' },
    },
  },
})
