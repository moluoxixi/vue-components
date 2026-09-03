import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'input-number',
  order: 50,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'antd.input-number',
      source: s.antdSource('number', 'a-input-number'),
      title: 'Number',
      category: 'Fields',
      icon: s.Hash,
      component: s.InputNumber,
      defaultField: 'number',
      runtime: {
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      value: { kind: 'number' },
      props: {
        min: { label: 'Minimum', control: 'number' },
        max: { label: 'Maximum', control: 'number' },
        step: { label: 'Step', control: 'number', default: 1, min: 0 },
        controls: { label: 'Controls', control: 'boolean', default: true },
      },
    }),
    locale: {
      title: '数字输入',
      category: '字段',
      setters: { defaultValue: '默认值', min: '最小值', max: '最大值', step: '步长', controls: '显示控件' },
    },
  },
})
