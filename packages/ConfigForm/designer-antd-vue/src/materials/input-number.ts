import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'input-number',
  order: 50,
  value: {
    material: {
      key: 'antd.input-number',
      source: s.antdSource('number', 'a-input-number'),
      version: 1,
      kind: 'field',
      title: 'Number',
      category: 'Fields',
      icon: s.Hash,
      runtime: {
        component: s.InputNumber,
        ...s.valueBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      setters: [
        s.defaultValueSetter('number'),
        s.propSetter('min', 'Minimum', 'number'),
        s.propSetter('max', 'Maximum', 'number'),
        s.propSetter('step', 'Step', 'number', undefined, { min: 0 }),
        s.propSetter('controls', 'Controls', 'boolean'),
      ],
      createNode: ({ id, field = 'number' }) => ({
        id,
        kind: 'field',
        material: 'antd.input-number',
        field,
        label: 'Number',
        props: { step: 1, controls: true },
      }),
    },
    locale: {
      title: '数字输入',
      category: '字段',
      setters: { defaultValue: '默认值', min: '最小值', max: '最大值', step: '步长', controls: '显示控件' },
    },
  },
})
