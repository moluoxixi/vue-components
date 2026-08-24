import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'collapse-item',
  order: 150,
  value: {
    material: {
      key: 'element.collapse-item',
      version: 1,
      kind: 'container',
      title: 'Collapse item',
      category: 'Layout',
      icon: shared.PanelBottom,
      runtime: { component: shared.ElCollapseItem },
      setters: [shared.propSetter('title', 'Title', 'text'), shared.propSetter('disabled', 'Disabled', 'boolean')],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
      createNode: ({ id }) => ({ id, kind: 'container', material: 'element.collapse-item', props: { title: 'Item', name: id }, slots: { default: [] } }),
    },
    locale: { title: '折叠项', category: '布局', setters: { title: '标题', disabled: '禁用' }, slots: { default: '内容' } },
  },
})
