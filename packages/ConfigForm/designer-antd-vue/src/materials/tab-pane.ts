import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'tab-pane',
  order: 180,
  value: {
    material: {
      key: 'antd.tab-pane',
      version: 1,
      kind: 'container',
      title: 'Tab pane',
      category: 'Layout',
      icon: s.PanelBottom,
      runtime: { component: s.TabPane, designerComponent: s.AntdTabPanePreview },
      allowedParents: [{ material: 'antd.tabs', slot: 'default' }],
      setters: [s.propSetter('tab', 'Label', 'text'), s.propSetter('disabled', 'Disabled', 'boolean')],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
      createNode: ({ id }) => ({
        id,
        kind: 'container',
        material: 'antd.tab-pane',
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
