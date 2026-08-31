import type { DesignerNodeSubgraphTemplate } from '@moluoxixi/config-form-designer'
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
      kind: 'layout',
      title: 'Collapse',
      category: 'Layout',
      icon: shared.ListCollapse,
      runtime: { component: shared.ElCollapse },
      events: [{ name: 'change', title: 'Expanded items change' }],
      setters: [shared.propSetter('accordion', 'Accordion', 'boolean')],
      slots: [{ name: 'default', title: 'Items', accepts: ['layout'], materials: ['element.collapse-item'] }],
      createNode: ({ id }): DesignerNodeSubgraphTemplate => {
        const itemId = `${id}-item-1`
        return {
          root: [{ nodeId: id, placement: {} }],
          nodesById: {
            [id]: {
              id,
              kind: 'layout',
              component: 'element.collapse',
              props: { accordion: false, modelValue: [itemId] },
              slots: { default: [{ nodeId: itemId, placement: {} }] },
            },
            [itemId]: {
              id: itemId,
              kind: 'layout',
              component: 'element.collapse-item',
              props: { title: 'Item 1', name: itemId },
              slots: { default: [] },
            },
          },
        }
      },
    },
    locale: { title: '折叠面板', category: '布局', setters: { accordion: '手风琴模式' }, slots: { default: '面板项' } },
  },
})
