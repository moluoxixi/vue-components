import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'grid',
  order: 220,
  value: {
    material: {
      key: 'antd.grid',
      version: 1,
      kind: 'container',
      title: 'Grid',
      category: 'Layout',
      icon: s.LayoutGrid,
      runtime: { component: s.AntdGridLayout },
      setters: [
        s.propSetter('columns', 'Columns', 'number', undefined, { min: 1, max: 12, step: 1 }),
        s.propSetter('gap', 'Gap', 'number', undefined, { min: 0, max: 64, step: 4 }),
      ],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
      createNode: ({ id }) => ({
        id,
        kind: 'container',
        material: 'antd.grid',
        props: { columns: 2, gap: 12 },
        slots: { default: [] },
      }),
    },
    locale: {
      title: 'Grid 栅格',
      category: '布局',
      setters: { columns: '列数', gap: '间距' },
      slots: { default: '内容' },
    },
  },
})
