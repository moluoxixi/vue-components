import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'time',
  order: 140,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'antd.time',
      source: s.antdSource('text', 'a-time-picker'),
      title: 'Time',
      category: 'Date & time',
      icon: s.Clock,
      component: s.TimePicker,
      runtime: {
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      value: { kind: 'time' },
      defaultProps: { valueFormat: 'HH:mm:ss' },
      props: {
        placeholder: { label: 'Placeholder', control: 'text', default: '' },
        allowClear: { label: 'Allow clear', control: 'boolean' },
        format: { label: 'Display format', control: 'text' },
      },
    }),
    locale: {
      title: '时间',
      category: '日期时间',
      setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', format: '显示格式' },
    },
  },
})
