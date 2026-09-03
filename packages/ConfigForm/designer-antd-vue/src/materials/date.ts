import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'date',
  order: 130,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'antd.date',
      source: s.antdSource('text', 'a-date-picker'),
      title: 'Date',
      category: 'Date & time',
      icon: s.Calendar,
      component: s.DatePicker,
      runtime: {
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      value: { kind: 'date' },
      defaultProps: { valueFormat: 'YYYY-MM-DD' },
      props: {
        placeholder: { label: 'Placeholder', control: 'text', default: '' },
        allowClear: { label: 'Allow clear', control: 'boolean' },
        format: { label: 'Display format', control: 'text' },
      },
    }),
    locale: {
      title: '日期',
      category: '日期时间',
      setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', format: '显示格式' },
    },
  },
})
