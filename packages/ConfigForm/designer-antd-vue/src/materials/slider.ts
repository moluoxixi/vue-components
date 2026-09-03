import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'slider',
  order: 110,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'antd.slider',
      source: s.antdSource('number', 'a-slider'),
      title: 'Slider',
      category: 'Choices',
      icon: s.SlidersHorizontal,
      component: s.Slider,
      runtime: {
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      value: { kind: 'number', default: 0 },
      props: {
        min: { label: 'Minimum', control: 'number', default: 0 },
        max: { label: 'Maximum', control: 'number', default: 100 },
        step: { label: 'Step', control: 'number', default: 1, min: 0 },
      },
    }),
    locale: {
      title: '滑块',
      category: '选择',
      setters: { defaultValue: '默认值', min: '最小值', max: '最大值', step: '步长' },
    },
  },
})
