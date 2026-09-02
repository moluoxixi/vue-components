import type { DesignerNodeSubgraphTemplate } from '@moluoxixi/config-form-designer'
import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'tabs',
  order: 120,
  value: {
    material: {
      key: 'element.tabs',
      source: shared.elementSource('div', 'el-tabs'),
      version: 1,
      kind: 'layout',
      title: 'Tabs',
      category: 'Layout',
      icon: shared.PanelsTopLeft,
      runtime: { component: shared.ElTabs },
      events: [{ name: 'tab-change', title: 'Active tab change' }],
      setters: [
        shared.propSetter('tabPosition', 'Position', 'select', [{ label: 'Top', value: 'top' }, { label: 'Right', value: 'right' }, { label: 'Bottom', value: 'bottom' }, { label: 'Left', value: 'left' }]),
        shared.propSetter('stretch', 'Stretch', 'boolean'),
      ],
      slots: [{ name: 'default', title: 'Panes', accepts: ['layout'], materials: ['element.tab-pane'] }],
      createNode: ({ id }): DesignerNodeSubgraphTemplate => {
        const paneId = `${id}-pane-1`
        return {
          root: [{ nodeId: id, placement: {} }],
          nodesById: {
            [id]: {
              id,
              kind: 'layout',
              component: 'element.tabs',
              props: { tabPosition: 'top', modelValue: paneId },
              slots: { default: [{ nodeId: paneId, placement: {} }] },
            },
            [paneId]: {
              id: paneId,
              kind: 'layout',
              component: 'element.tab-pane',
              props: { label: 'Tab 1', name: paneId },
              slots: { default: [] },
            },
          },
        }
      },
    },
    locale: { title: '标签页', category: '布局', setters: { tabPosition: '位置', stretch: '拉伸' }, options: { tabPosition: { top: '顶部', right: '右侧', bottom: '底部', left: '左侧' } }, slots: { default: '面板' } },
  },
})
