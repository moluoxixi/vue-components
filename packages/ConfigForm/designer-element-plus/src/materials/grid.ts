import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'grid',
  order: 170,
  value: {
    material: {
      key: 'element.grid',
      source: shared.elementSource('div', 'div', { native: true, render: 'layout-grid' }),
      version: 1,
      kind: 'layout',
      title: 'Grid',
      category: 'Layout',
      icon: shared.LayoutGrid,
      runtime: { component: shared.ElementGridLayout },
      setters: [shared.propSetter('columns', 'Columns', 'number', undefined, { min: 1, max: 12, step: 1 }), shared.propSetter('gap', 'Gap', 'number', undefined, { min: 0, max: 64, step: 4 })],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'layout'] }],
      createNode: ({ id }) => ({ id, kind: 'layout', component: 'element.grid', props: { columns: 2, gap: 12 }, slots: { default: [] } }),
    },
    locale: { title: 'Grid 栅格', category: '布局', setters: { columns: '列数', gap: '间距' }, slots: { default: '内容' } },
  },
})
