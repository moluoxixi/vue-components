import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'time',
  order: 140,
  value: {
    material: {
      key: 'antd.time',
      source: s.antdSource('text', 'a-time-picker'),
      version: 1,
      kind: 'field',
      title: 'Time',
      category: 'Date & time',
      icon: s.Clock,
      runtime: {
        component: s.TimePicker,
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      setters: [
        s.defaultValueSetter('time'),
        s.placeholderSetter,
        s.allowClearSetter,
        s.propSetter('format', 'Display format', 'text'),
      ],
      createNode: ({ id, field = 'time' }) => ({
        id,
        kind: 'field',
        component: 'antd.time',
        field,
        label: 'Time',
        props: { valueFormat: 'HH:mm:ss', placeholder: '' },
      }),
    },
    locale: {
      title: '时间',
      category: '日期时间',
      setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', format: '显示格式' },
    },
  },
})
