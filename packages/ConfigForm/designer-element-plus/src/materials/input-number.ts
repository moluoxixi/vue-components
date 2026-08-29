import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'input-number',
  order: 30,
  value: {
    material: {
      key: 'element.input-number',
      source: shared.elementSource('number', 'el-input-number'),
      version: 1,
      kind: 'field',
      title: 'Number',
      category: 'Fields',
      icon: shared.Hash,
      runtime: { component: shared.ElInputNumber, readonlyProp: 'disabled', readonlyRender: shared.renderElementPlusRawReadonly },
      setters: [
        shared.defaultValueSetter('number'),
        shared.propSetter('min', 'Minimum', 'number'),
        shared.propSetter('max', 'Maximum', 'number'),
        shared.propSetter('step', 'Step', 'number', undefined, { min: 0 }),
        shared.propSetter('controls', 'Controls', 'boolean'),
      ],
      createNode: ({ id, field = 'number' }) => ({
        id,
        kind: 'field',
        material: 'element.input-number',
        field,
        label: 'Number',
        props: { step: 1, controls: true },
      }),
    },
    locale: { title: '数字输入', category: '字段', setters: { defaultValue: '默认值', min: '最小值', max: '最大值', step: '步长', controls: '显示控件' } },
  },
})
