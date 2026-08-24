import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'time',
  order: 90,
  value: {
    material: {
      key: 'element.time',
      version: 1,
      kind: 'field',
      title: 'Time',
      category: 'Date & time',
      icon: shared.Clock,
      runtime: { component: shared.ElTimePicker, readonlyProp: 'readonly', readonlyRender: shared.renderElementPlusRawReadonly },
      setters: [shared.defaultValueSetter('time'), shared.placeholderSetter, shared.clearableSetter, shared.propSetter('format', 'Display format', 'text')],
      createNode: ({ id, field = 'time' }) => ({
        id,
        kind: 'field',
        material: 'element.time',
        field,
        label: 'Time',
        props: { valueFormat: 'HH:mm:ss', placeholder: '' },
      }),
    },
    locale: { title: '时间', category: '日期时间', setters: { defaultValue: '默认值', placeholder: '占位文本', clearable: '可清空', format: '显示格式' } },
  },
})
