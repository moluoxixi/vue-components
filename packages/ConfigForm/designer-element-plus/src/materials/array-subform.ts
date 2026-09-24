import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'array-subform',
  order: 190,
  value: {
    material: {
      key: 'element.array-subform',
      source: shared.elementSource('div', 'section', { native: true, render: 'section' }),
      version: 1,
      kind: 'layout',
      title: 'Array subform',
      category: 'Layout',
      icon: shared.Rows3,
      runtime: { component: shared.ElementSection },
      setters: [
        shared.propSetter('title', 'Title', 'text'),
        shared.propSetter('arrayDisplay', 'Display', 'select', [{ label: 'List', value: 'list' }, { label: 'Table', value: 'table' }]),
        shared.propSetter('readonly', 'Read only', 'boolean'),
        shared.disabledSetter,
      ],
      slots: [{ name: 'default', title: 'Row fields', accepts: ['field', 'layout', 'element'] }],
      createNode: ({ id, field }) => ({
        id,
        kind: 'layout',
        component: 'element.array-subform',
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
