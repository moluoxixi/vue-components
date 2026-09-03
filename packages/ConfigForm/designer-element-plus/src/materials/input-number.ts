import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'input-number',
  order: 30,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'element.input-number',
      source: shared.elementSource('number', 'el-input-number'),
      title: 'Number',
      category: 'Fields',
      icon: shared.Hash,
      component: shared.ElInputNumber,
      defaultField: 'number',
      runtime: { readonlyProp: 'disabled', readonlyRender: shared.renderElementPlusRawReadonly },
      value: { kind: 'number' },
      props: {
        min: { label: 'Minimum', control: 'number' },
        max: { label: 'Maximum', control: 'number' },
        step: { label: 'Step', control: 'number', default: 1, min: 0 },
        controls: { label: 'Controls', control: 'boolean', default: true },
      },
    }),
    locale: { title: '数字输入', category: '字段', setters: { defaultValue: '默认值', min: '最小值', max: '最大值', step: '步长', controls: '显示控件' } },
  },
})
