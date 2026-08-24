import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'card',
  order: 110,
  value: {
    material: {
      key: 'element.card',
      version: 1,
      kind: 'container',
      title: 'Card',
      category: 'Layout',
      icon: shared.Square,
      runtime: { component: shared.ElCard },
      setters: [
        shared.propSetter('header', 'Header', 'text'),
        shared.propSetter('shadow', 'Shadow', 'select', [{ label: 'Always', value: 'always' }, { label: 'Hover', value: 'hover' }, { label: 'Never', value: 'never' }]),
      ],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'container'] }],
      createNode: ({ id }) => ({ id, kind: 'container', material: 'element.card', props: { header: 'Card', shadow: 'never' }, slots: { default: [] } }),
    },
    locale: { title: '卡片', category: '布局', setters: { header: '头部', shadow: '阴影' }, options: { shadow: { always: '总是', hover: '悬停', never: '从不' } }, slots: { default: '内容' } },
  },
})
