import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'switch',
  order: 70,
  value: {
    material: {
      key: 'element.switch',
      source: shared.elementSource('boolean', 'el-switch'),
      version: 1,
      kind: 'field',
      title: 'Switch',
      category: 'Choices',
      icon: shared.ToggleLeft,
      runtime: { component: shared.ElSwitch, readonlyProp: 'disabled', readonlyRender: shared.renderElementPlusSwitchReadonly },
      setters: [shared.defaultValueSetter('boolean'), shared.propSetter('activeText', 'Active text', 'text'), shared.propSetter('inactiveText', 'Inactive text', 'text')],
      createNode: ({ id, field = 'switch' }) => ({
        id,
        kind: 'field',
        material: 'element.switch',
        field,
        label: 'Switch',
        defaultValue: false,
      }),
    },
    locale: { title: '开关', category: '选择', setters: { defaultValue: '默认值', activeText: '开启文案', inactiveText: '关闭文案' } },
  },
})
