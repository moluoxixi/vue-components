import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'section',
  order: 150,
  value: {
    material: {
      key: 'antd.section',
      version: 1,
      kind: 'container',
      title: 'Section',
      category: 'Layout',
      icon: s.LayoutPanelTop,
      runtime: { component: s.AntdSection },
      setters: [s.propSetter('title', 'Title', 'text'), s.propSetter('description', 'Description', 'textarea')],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
      createNode: ({ id }) => ({
        id,
        kind: 'container',
        material: 'antd.section',
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
