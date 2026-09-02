import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'collapse-item',
  order: 200,
  value: {
    material: {
      key: 'antd.collapse-item',
      source: s.antdSource('div', 'a-collapse-panel'),
      version: 1,
      kind: 'layout',
      title: 'Collapse item',
      category: 'Layout',
      icon: s.PanelBottom,
      runtime: { component: s.CollapsePanel },
      allowedParents: [{ material: 'antd.collapse', slot: 'default' }],
      setters: [s.propSetter('header', 'Title', 'text'), s.propSetter('disabled', 'Disabled', 'boolean')],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'layout'] }],
      createNode: ({ id }) => ({
        id,
        kind: 'layout',
        component: 'antd.collapse-item',
        props: { header: 'Item', key: id },
        slots: { default: [] },
      }),
    },
    locale: {
      title: '折叠项',
      category: '布局',
      setters: { header: '标题', disabled: '禁用' },
      slots: { default: '内容' },
    },
  },
})
