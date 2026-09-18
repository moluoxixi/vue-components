import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'object-group',
  order: 180,
  value: {
    material: {
      key: 'element.object-group',
      source: shared.elementSource('div', 'section', { native: true, render: 'section' }),
      version: 1,
      kind: 'layout',
      title: 'Object group',
      category: 'Layout',
      icon: shared.LayoutPanelTop,
      runtime: { component: shared.ElementSection },
      setters: [
        shared.propSetter('title', 'Title', 'text'),
        shared.propSetter('readonly', 'Read only', 'boolean'),
        shared.disabledSetter,
      ],
      slots: [{ name: 'default', title: 'Fields', accepts: ['field', 'layout'] }],
      createNode: ({ id, field }) => ({
        id,
        kind: 'layout',
        component: 'element.object-group',
        props: { title: 'Object group' },
        valueScope: { kind: 'object', field: field ?? 'object' },
        slots: { default: [] },
      }),
    },
    locale: {
      title: '对象分组',
      category: '布局',
      setters: { title: '标题', readonly: '只读', disabled: '禁用' },
      slots: { default: '字段' },
    },
  },
})
