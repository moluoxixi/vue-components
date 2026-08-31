import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'tab-pane',
  order: 180,
  value: {
    material: {
      key: 'antd.tab-pane',
      source: s.antdSource('div', 'a-tab-pane'),
      version: 1,
      kind: 'layout',
      title: 'Tab pane',
      category: 'Layout',
      icon: s.PanelBottom,
      runtime: { component: s.TabPane },
      allowedParents: [{ material: 'antd.tabs', slot: 'default' }],
      setters: [s.propSetter('tab', 'Label', 'text'), s.propSetter('disabled', 'Disabled', 'boolean')],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'layout'] }],
      createNode: ({ id }) => ({
        id,
        kind: 'layout',
        component: 'antd.tab-pane',
        props: { tab: 'Tab', key: id },
        slots: { default: [] },
      }),
    },
    locale: {
      title: '标签面板',
      category: '布局',
      setters: { tab: '标签', disabled: '禁用' },
      slots: { default: '内容' },
    },
  },
})
