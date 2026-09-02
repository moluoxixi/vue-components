import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'date',
  order: 80,
  value: {
    material: {
      key: 'element.date',
      source: shared.elementSource('text', 'el-date-picker'),
      version: 1,
      kind: 'field',
      title: 'Date',
      category: 'Date & time',
      icon: shared.Calendar,
      runtime: { component: shared.ElDatePicker, readonlyProp: 'readonly', readonlyRender: shared.renderElementPlusRawReadonly },
      setters: [shared.defaultValueSetter('date'), shared.placeholderSetter, shared.clearableSetter, shared.propSetter('format', 'Display format', 'text')],
      createNode: ({ id, field = 'date' }) => ({
        id,
        kind: 'field',
        component: 'element.date',
        field,
        label: 'Date',
        props: { type: 'date', valueFormat: 'YYYY-MM-DD', placeholder: '' },
      }),
    },
    locale: { title: '日期', category: '日期时间', setters: { defaultValue: '默认值', placeholder: '占位文本', clearable: '可清空', format: '显示格式' } },
  },
})
