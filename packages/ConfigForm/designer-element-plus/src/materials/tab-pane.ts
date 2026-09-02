import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'tab-pane',
  order: 130,
  value: {
    material: {
      key: 'element.tab-pane',
      source: shared.elementSource('div', 'el-tab-pane'),
      version: 1,
      kind: 'layout',
      title: 'Tab pane',
      category: 'Layout',
      icon: shared.PanelBottom,
      runtime: { component: shared.ElTabPane },
      allowedParents: [{ material: 'element.tabs', slot: 'default' }],
      setters: [shared.propSetter('label', 'Label', 'text'), shared.propSetter('disabled', 'Disabled', 'boolean')],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'layout'] }],
      createNode: ({ id }) => ({ id, kind: 'layout', component: 'element.tab-pane', props: { label: 'Tab', name: id }, slots: { default: [] } }),
    },
    locale: { title: '标签面板', category: '布局', setters: { label: '标签', disabled: '禁用' }, slots: { default: '内容' } },
  },
})
