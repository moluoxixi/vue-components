import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'date',
  order: 80,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'element.date',
      source: shared.elementSource('text', 'el-date-picker'),
      title: 'Date',
      category: 'Date & time',
      icon: shared.Calendar,
      component: shared.ElDatePicker,
      runtime: { readonlyProp: 'readonly', readonlyRender: shared.renderElementPlusRawReadonly },
      value: { kind: 'date' },
      defaultProps: { type: 'date', valueFormat: 'YYYY-MM-DD' },
      props: {
        placeholder: { label: 'Placeholder', control: 'text', default: '' },
        clearable: { label: 'Clearable', control: 'boolean' },
        format: { label: 'Display format', control: 'text' },
      },
    }),
    locale: { title: '日期', category: '日期时间', setters: { defaultValue: '默认值', placeholder: '占位文本', clearable: '可清空', format: '显示格式' } },
  },
})
