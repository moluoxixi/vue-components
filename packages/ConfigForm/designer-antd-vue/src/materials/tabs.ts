import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'tabs',
  order: 170,
  value: {
    material: {
      key: 'antd.tabs',
      source: s.antdSource('div', 'a-tabs'),
      version: 1,
      kind: 'container',
      title: 'Tabs',
      category: 'Layout',
      icon: s.PanelsTopLeft,
      runtime: { component: s.Tabs, designerComponent: s.AntdTabsPreview },
      events: [{ name: 'change', title: 'Active tab change' }],
      setters: [
        s.propSetter('tabPosition', 'Position', 'select', [
          { label: 'Top', value: 'top' },
          { label: 'Right', value: 'right' },
          { label: 'Bottom', value: 'bottom' },
          { label: 'Left', value: 'left' },
        ]),
        s.propSetter('centered', 'Centered', 'boolean'),
      ],
      slots: [{ name: 'default', title: 'Panes', accepts: ['container'], materials: ['antd.tab-pane'] }],
      createNode: ({ id }) => {
        const paneId = `${id}-pane-1`
        return {
          id,
          kind: 'container',
          material: 'antd.tabs',
          props: { tabPosition: 'top', activeKey: paneId },
          slots: {
            default: [
              {
                id: paneId,
                kind: 'container',
                material: 'antd.tab-pane',
                props: { tab: 'Tab 1', key: paneId },
                slots: { default: [] },
              },
            ],
          },
        }
      },
    },
    locale: {
      title: '标签页',
      category: '布局',
      setters: { tabPosition: '位置', centered: '居中' },
      options: { tabPosition: { top: '顶部', right: '右侧', bottom: '底部', left: '左侧' } },
      slots: { default: '面板' },
    },
  },
})
