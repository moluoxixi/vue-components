import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'section',
  order: 150,
  value: {
    material: {
      key: 'antd.section',
      source: s.antdSource('div', 'section', { native: true, render: 'section' }),
      version: 1,
      kind: 'layout',
      title: 'Section',
      category: 'Layout',
      icon: s.LayoutPanelTop,
      runtime: { component: s.AntdSection },
      setters: [s.propSetter('title', 'Title', 'text'), s.propSetter('description', 'Description', 'textarea')],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'layout'] }],
      createNode: ({ id }) => ({
        id,
        kind: 'layout',
        component: 'antd.section',
        props: { title: 'Section' },
        slots: { default: [] },
      }),
    },
    locale: {
      title: '分区',
      category: '布局',
      setters: { title: '标题', description: '描述' },
      slots: { default: '内容' },
    },
  },
})
