import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'array-subform',
  order: 240,
  value: {
    material: {
      key: 'antd.array-subform',
      source: s.antdSource('div', 'section', { native: true, render: 'section' }),
      version: 1,
      kind: 'layout',
      title: 'Array subform',
      category: 'Layout',
      icon: s.Rows3,
      runtime: { component: s.AntdSection },
      setters: [
        s.propSetter('title', 'Title', 'text'),
        s.propSetter('arrayDisplay', 'Display', 'select', [{ label: 'List', value: 'list' }, { label: 'Table', value: 'table' }]),
        s.propSetter('readonly', 'Read only', 'boolean'),
        s.disabledSetter,
      ],
      slots: [{ name: 'default', title: 'Row fields', accepts: ['field', 'layout'] }],
      createNode: ({ id, field }) => ({
        id,
        kind: 'layout',
        component: 'antd.array-subform',
        props: { title: 'Array subform', arrayDisplay: 'list' },
        valueScope: { kind: 'array', field: field ?? 'items', minItems: 0 },
        slots: { default: [] },
      }),
    },
    locale: {
      title: '数组子表单',
      category: '布局',
      setters: {
        title: '标题',
        arrayDisplay: '展示方式',
        readonly: '只读',
        disabled: '禁用',
      },
      options: { arrayDisplay: { list: '列表', table: '表格' } },
      slots: { default: '行字段' },
    },
  },
})
