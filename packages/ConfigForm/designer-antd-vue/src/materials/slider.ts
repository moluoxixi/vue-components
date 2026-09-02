import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'slider',
  order: 110,
  value: {
    material: {
      key: 'antd.slider',
      source: s.antdSource('number', 'a-slider'),
      version: 1,
      kind: 'field',
      title: 'Slider',
      category: 'Choices',
      icon: s.SlidersHorizontal,
      runtime: {
        component: s.Slider,
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      setters: [
        s.defaultValueSetter('number'),
        s.propSetter('min', 'Minimum', 'number'),
        s.propSetter('max', 'Maximum', 'number'),
        s.propSetter('step', 'Step', 'number', undefined, { min: 0 }),
      ],
      createNode: ({ id, field = 'slider' }) => ({
        id,
        kind: 'field',
        component: 'antd.slider',
        field,
        label: 'Slider',
        defaultValue: 0,
        props: { min: 0, max: 100, step: 1 },
      }),
    },
    locale: {
      title: '滑块',
      category: '选择',
      setters: { defaultValue: '默认值', min: '最小值', max: '最大值', step: '步长' },
    },
  },
})
