import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'time',
  order: 90,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'element.time',
      source: shared.elementSource('text', 'el-time-picker'),
      title: 'Time',
      category: 'Date & time',
      icon: shared.Clock,
      component: shared.ElTimePicker,
      runtime: { readonlyProp: 'readonly', readonlyRender: shared.renderElementPlusRawReadonly },
      value: { kind: 'time' },
      defaultProps: { valueFormat: 'HH:mm:ss' },
      props: {
        placeholder: { label: 'Placeholder', control: 'text', default: '' },
        clearable: { label: 'Clearable', control: 'boolean' },
        format: { label: 'Display format', control: 'text' },
      },
    }),
    locale: { title: '时间', category: '日期时间', setters: { defaultValue: '默认值', placeholder: '占位文本', clearable: '可清空', format: '显示格式' } },
  },
})
