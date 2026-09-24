import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'object-group',
  order: 230,
  value: {
    material: {
      key: 'antd.object-group',
      source: s.antdSource('div', 'section', { native: true, render: 'section' }),
      version: 1,
      kind: 'layout',
      title: 'Object group',
      category: 'Layout',
      icon: s.LayoutPanelTop,
      runtime: { component: s.AntdSection },
      setters: [
        s.propSetter('title', 'Title', 'text'),
        s.propSetter('readonly', 'Read only', 'boolean'),
        s.disabledSetter,
      ],
      slots: [{ name: 'default', title: 'Fields', accepts: ['field', 'layout', 'element'] }],
      createNode: ({ id, field }) => ({
        id,
        kind: 'layout',
        component: 'antd.object-group',
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
