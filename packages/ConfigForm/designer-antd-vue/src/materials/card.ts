import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'card',
  order: 160,
  value: {
    material: {
      key: 'antd.card',
      source: s.antdSource('div', 'a-card'),
      version: 1,
      kind: 'layout',
      title: 'Card',
      category: 'Layout',
      icon: s.Square,
      runtime: { component: s.Card },
      setters: [s.propSetter('title', 'Title', 'text'), s.propSetter('bordered', 'Bordered', 'boolean')],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'layout'] }],
      createNode: ({ id }) => ({
        id,
        kind: 'layout',
        component: 'antd.card',
        props: { title: 'Card', bordered: true },
        slots: { default: [] },
      }),
    },
    locale: {
      title: '卡片',
      category: '布局',
      setters: { title: '标题', bordered: '显示边框' },
      slots: { default: '内容' },
    },
  },
})
