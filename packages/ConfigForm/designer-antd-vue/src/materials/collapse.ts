import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'collapse',
  order: 190,
  value: {
    material: {
      key: 'antd.collapse',
      version: 1,
      kind: 'container',
      title: 'Collapse',
      category: 'Layout',
      icon: s.ListCollapse,
      runtime: { component: s.Collapse, designerComponent: s.AntdCollapsePreview },
      setters: [s.propSetter('accordion', 'Accordion', 'boolean')],
      slots: [{ name: 'default', title: 'Items', accepts: ['container'], materials: ['antd.collapse-item'] }],
      createNode: ({ id }) => {
        const itemId = `${id}-item-1`
        return {
          id,
          kind: 'container',
          material: 'antd.collapse',
          props: { accordion: false, activeKey: [itemId] },
          slots: {
            default: [
              {
                id: itemId,
                kind: 'container',
                material: 'antd.collapse-item',
                props: { header: 'Item 1', key: itemId },
                slots: { default: [] },
              },
            ],
          },
        }
      },
    },
    locale: { title: '折叠面板', category: '布局', setters: { accordion: '手风琴模式' }, slots: { default: '面板项' } },
  },
})
