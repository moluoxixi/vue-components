import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'tabs',
  order: 120,
  value: {
    material: {
      key: 'element.tabs',
      version: 1,
      kind: 'container',
      title: 'Tabs',
      category: 'Layout',
      icon: shared.PanelsTopLeft,
      runtime: { component: shared.ElTabs },
      setters: [
        shared.propSetter('tabPosition', 'Position', 'select', [{ label: 'Top', value: 'top' }, { label: 'Right', value: 'right' }, { label: 'Bottom', value: 'bottom' }, { label: 'Left', value: 'left' }]),
        shared.propSetter('stretch', 'Stretch', 'boolean'),
      ],
      slots: [{ name: 'default', title: 'Panes', accepts: ['container'], materials: ['element.tab-pane'] }],
      createNode: ({ id }) => {
        const paneId = `${id}-pane-1`
        return { id, kind: 'container', material: 'element.tabs', props: { tabPosition: 'top', modelValue: paneId }, slots: { default: [{ id: paneId, kind: 'container', material: 'element.tab-pane', props: { label: 'Tab 1', name: paneId }, slots: { default: [] } }] } }
      },
    },
    locale: { title: '标签页', category: '布局', setters: { tabPosition: '位置', stretch: '拉伸' }, options: { tabPosition: { top: '顶部', right: '右侧', bottom: '底部', left: '左侧' } }, slots: { default: '面板' } },
  },
})
