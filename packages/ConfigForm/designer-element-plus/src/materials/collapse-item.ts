import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'collapse-item',
  order: 150,
  value: {
    material: {
      key: 'element.collapse-item',
      source: shared.elementSource('div', 'el-collapse-item'),
      version: 1,
      kind: 'layout',
      title: 'Collapse item',
      category: 'Layout',
      icon: shared.PanelBottom,
      runtime: { component: shared.ElCollapseItem },
      allowedParents: [{ material: 'element.collapse', slot: 'default' }],
      setters: [shared.propSetter('title', 'Title', 'text'), shared.propSetter('disabled', 'Disabled', 'boolean')],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'layout'] }],
      createNode: ({ id }) => ({ id, kind: 'layout', component: 'element.collapse-item', props: { title: 'Item', name: id }, slots: { default: [] } }),
    },
    locale: { title: '折叠项', category: '布局', setters: { title: '标题', disabled: '禁用' }, slots: { default: '内容' } },
  },
})
