import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'switch',
  order: 100,
  value: {
    material: {
      key: 'antd.switch',
      source: s.antdSource('boolean', 'a-switch'),
      version: 1,
      kind: 'field',
      title: 'Switch',
      category: 'Choices',
      icon: s.ToggleLeft,
      runtime: {
        component: s.Switch,
        ...s.checkedBinding,
        readonlyProp: 'disabled',
        readonlyRender: s.renderAntdVueSwitchReadonly,
      },
      setters: [
        s.defaultValueSetter('boolean'),
        s.propSetter('checkedChildren', 'Checked text', 'text'),
        s.propSetter('unCheckedChildren', 'Unchecked text', 'text'),
      ],
      createNode: ({ id, field = 'switch' }) => ({
        id,
        kind: 'field',
        component: 'antd.switch',
        field,
        label: 'Switch',
        defaultValue: false,
      }),
    },
    locale: {
      title: '开关',
      category: '选择',
      setters: { defaultValue: '默认值', checkedChildren: '开启文案', unCheckedChildren: '关闭文案' },
    },
  },
})
