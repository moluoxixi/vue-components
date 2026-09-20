import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'detail-table',
  order: 250,
  value: {
    material: {
      key: 'antd.detail-table',
      source: s.antdSource('div', 'section', { native: true, render: 'section' }),
      version: 1,
      kind: 'layout',
      title: 'Detail table',
      category: 'Layout',
      icon: s.LayoutGrid,
      runtime: { component: s.AntdSection },
      setters: [
        s.propSetter('title', 'Title', 'text'),
        s.propSetter('arrayDisplay', 'Display', 'select', [{ label: 'List', value: 'list' }, { label: 'Table', value: 'table' }]),
        s.propSetter('readonly', 'Read only', 'boolean'),
        s.disabledSetter,
      ],
      slots: [{ name: 'default', title: 'Columns', accepts: ['field', 'layout', 'element'] }],
      createNode: ({ id, field }) => ({
        id,
        kind: 'layout',
        component: 'antd.detail-table',
        props: { title: 'Detail table', arrayDisplay: 'table' },
        valueScope: { kind: 'array', field: field ?? 'details', minItems: 0 },
        slots: { default: [] },
      }),
    },
    locale: {
      title: '明细表格',
      category: '布局',
      setters: {
        title: '标题',
        arrayDisplay: '展示方式',
        readonly: '只读',
        disabled: '禁用',
      },
      options: { arrayDisplay: { list: '列表', table: '表格' } },
      slots: { default: '列' },
    },
  },
})
