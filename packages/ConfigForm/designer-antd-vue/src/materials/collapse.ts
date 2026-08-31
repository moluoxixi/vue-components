import type { DesignerNodeSubgraphTemplate } from '@moluoxixi/config-form-designer'
import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'collapse',
  order: 190,
  value: {
    material: {
      key: 'antd.collapse',
      source: s.antdSource('div', 'a-collapse'),
      version: 1,
      kind: 'layout',
      title: 'Collapse',
      category: 'Layout',
      icon: s.ListCollapse,
      runtime: { component: s.Collapse },
      events: [{ name: 'change', title: 'Expanded items change' }],
      setters: [s.propSetter('accordion', 'Accordion', 'boolean')],
      slots: [{ name: 'default', title: 'Items', accepts: ['layout'], materials: ['antd.collapse-item'] }],
      createNode: ({ id }): DesignerNodeSubgraphTemplate => {
        const itemId = `${id}-item-1`
        return {
          root: [{ nodeId: id, placement: {} }],
          nodesById: {
            [id]: {
              id,
              kind: 'layout',
              component: 'antd.collapse',
              props: { accordion: false, activeKey: [itemId] },
              slots: { default: [{ nodeId: itemId, placement: {} }] },
            },
            [itemId]: {
              id: itemId,
              kind: 'layout',
              component: 'antd.collapse-item',
              props: { header: 'Item 1', key: itemId },
              slots: { default: [] },
            },
          },
        }
      },
    },
    locale: { title: '折叠面板', category: '布局', setters: { accordion: '手风琴模式' }, slots: { default: '面板项' } },
  },
})
