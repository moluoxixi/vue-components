import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'rate',
  order: 120,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'antd.rate',
      source: s.antdSource('number', 'a-rate'),
      title: 'Rate',
      category: 'Choices',
      icon: s.Star,
      component: s.Rate,
      runtime: {
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      value: { kind: 'number', default: 0 },
      props: {
        count: { label: 'Count', control: 'number', default: 5, min: 1, max: 10, step: 1 },
        allowHalf: { label: 'Allow half', control: 'boolean', default: false },
        allowClear: { label: 'Allow clear', control: 'boolean', default: true },
      },
    }),
    locale: {
      title: '评分',
      category: '选择',
      setters: { defaultValue: '默认值', count: '数量', allowHalf: '允许半选', allowClear: '可清空' },
    },
  },
})
