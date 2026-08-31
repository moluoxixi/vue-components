import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'date',
  order: 130,
  value: {
    material: {
      key: 'antd.date',
      source: s.antdSource('text', 'a-date-picker'),
      version: 1,
      kind: 'field',
      title: 'Date',
      category: 'Date & time',
      icon: s.Calendar,
      runtime: {
        component: s.DatePicker,
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      setters: [
        s.defaultValueSetter('date'),
        s.placeholderSetter,
        s.allowClearSetter,
        s.propSetter('format', 'Display format', 'text'),
      ],
      createNode: ({ id, field = 'date' }) => ({
        id,
        kind: 'field',
        component: 'antd.date',
        field,
        label: 'Date',
        props: { valueFormat: 'YYYY-MM-DD', placeholder: '' },
      }),
    },
    locale: {
      title: '日期',
      category: '日期时间',
      setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', format: '显示格式' },
    },
  },
})
