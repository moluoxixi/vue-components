import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'detail-table',
  order: 200,
  value: {
    material: {
      key: 'element.detail-table',
      source: shared.elementSource('div', 'detail-table', { native: true, render: 'section' }),
      version: 1,
      kind: 'layout',
      title: 'Detail table',
      category: 'Layout',
      icon: shared.LayoutGrid,
      runtime: { component: shared.ElementSection },
      setters: [
        shared.propSetter('title', 'Title', 'text'),
        { key: 'scopeField', label: 'Array key', path: ['valueScope', 'field'], control: 'text' },
        { key: 'itemKey', label: 'Row identity key', path: ['valueScope', 'itemKey'], control: 'text' },
        { key: 'minItems', label: 'Minimum rows', path: ['valueScope', 'minItems'], control: 'number', min: 0, step: 1 },
        { key: 'maxItems', label: 'Maximum rows', path: ['valueScope', 'maxItems'], control: 'number', min: 0, step: 1 },
        shared.propSetter('arrayDisplay', 'Display', 'select', [{ label: 'List', value: 'list' }, { label: 'Table', value: 'table' }]),
        shared.propSetter('readonly', 'Read only', 'boolean'),
        shared.disabledSetter,
      ],
      slots: [{ name: 'default', title: 'Columns', accepts: ['field', 'layout'] }],
      createNode: ({ id, field }) => ({
        id, kind: 'layout', component: 'element.detail-table',
        props: { title: 'Detail table', arrayDisplay: 'table' },
        valueScope: { kind: 'array', field: field ?? 'details', minItems: 0 },
        slots: { default: [] },
      }),
    },
    locale: {
      title: '明细表格', category: '布局',
      setters: {
        title: '标题', scopeField: '数组字段名', itemKey: '行业务主键', minItems: '最少行数', maxItems: '最多行数',
        arrayDisplay: '展示方式', readonly: '只读', disabled: '禁用',
      },
      options: { arrayDisplay: { list: '列表', table: '表格' } },
      slots: { default: '列' },
    },
  },
})
