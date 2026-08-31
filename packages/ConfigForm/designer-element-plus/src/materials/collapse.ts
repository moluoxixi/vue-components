import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'collapse',
  order: 140,
  value: {
    material: {
      key: 'element.collapse',
      source: shared.elementSource('div', 'el-collapse'),
      version: 1,
      kind: 'container',
      title: 'Collapse',
      category: 'Layout',
      icon: shared.ListCollapse,
      runtime: { component: shared.ElCollapse },
      events: [{ name: 'change', title: 'Expanded items change' }],
      setters: [shared.propSetter('accordion', 'Accordion', 'boolean')],
      slots: [{ name: 'default', title: 'Items', accepts: ['container'], materials: ['element.collapse-item'] }],
      createNode: ({ id }) => {
        const itemId = `${id}-item-1`
        return { id, kind: 'container', material: 'element.collapse', props: { accordion: false, modelValue: [itemId] }, slots: { default: [{ id: itemId, kind: 'container', material: 'element.collapse-item', props: { title: 'Item 1', name: itemId }, slots: { default: [] } }] } }
      },
    },
    locale: { title: '折叠面板', category: '布局', setters: { accordion: '手风琴模式' }, slots: { default: '面板项' } },
  },
})
