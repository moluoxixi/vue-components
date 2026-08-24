import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'section',
  order: 100,
  value: {
    material: {
      key: 'element.section',
      version: 1,
      kind: 'container',
      title: 'Section',
      category: 'Layout',
      icon: shared.LayoutPanelTop,
      runtime: { component: shared.ElementSection },
      setters: [shared.propSetter('title', 'Title', 'text'), shared.propSetter('description', 'Description', 'textarea')],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
      createNode: ({ id }) => ({ id, kind: 'container', material: 'element.section', props: { title: 'Section' }, slots: { default: [] } }),
    },
    locale: { title: '分区', category: '布局', setters: { title: '标题', description: '描述' }, slots: { default: '内容' } },
  },
})
