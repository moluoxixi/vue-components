import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'rate',
  order: 120,
  value: {
    material: {
      key: 'antd.rate',
      version: 1,
      kind: 'field',
      title: 'Rate',
      category: 'Choices',
      icon: s.Star,
      runtime: {
        component: s.Rate,
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      setters: [
        s.defaultValueSetter('number'),
        s.propSetter('count', 'Count', 'number', undefined, { min: 1, max: 10, step: 1 }),
        s.propSetter('allowHalf', 'Allow half', 'boolean'),
        s.allowClearSetter,
      ],
      createNode: ({ id, field = 'rate' }) => ({
        id,
        kind: 'field',
        material: 'antd.rate',
        field,
        label: 'Rate',
        defaultValue: 0,
        props: { count: 5, allowHalf: false, allowClear: true },
      }),
    },
    locale: {
      title: '评分',
      category: '选择',
      setters: { defaultValue: '默认值', count: '数量', allowHalf: '允许半选', allowClear: '可清空' },
    },
  },
})
