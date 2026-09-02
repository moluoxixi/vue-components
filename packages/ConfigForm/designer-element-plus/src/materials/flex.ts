import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as shared from './shared'

export default defineDesignerMaterialModule({
  name: 'flex',
  order: 160,
  value: {
    material: {
      key: 'element.flex',
      source: shared.elementSource('div', 'div', { native: true, render: 'layout-flex' }),
      version: 1,
      kind: 'layout',
      title: 'Flex Wrap',
      category: 'Layout',
      icon: shared.Rows3,
      runtime: { component: shared.ElementFlexLayout },
      setters: [
        shared.propSetter('direction', 'Direction', 'select', [{ label: 'Row', value: 'row' }, { label: 'Column', value: 'column' }]),
        shared.propSetter('wrap', 'Wrap', 'boolean'),
        shared.propSetter('justify', 'Justify', 'select', [{ label: 'Start', value: 'flex-start' }, { label: 'Center', value: 'center' }, { label: 'End', value: 'flex-end' }, { label: 'Between', value: 'space-between' }]),
        shared.propSetter('align', 'Align', 'select', [{ label: 'Start', value: 'flex-start' }, { label: 'Center', value: 'center' }, { label: 'End', value: 'flex-end' }, { label: 'Stretch', value: 'stretch' }]),
        shared.propSetter('gap', 'Gap', 'number', undefined, { min: 0, max: 64, step: 4 }),
        shared.propSetter('itemWidth', 'Item width', 'number', undefined, { min: 80, max: 600, step: 20 }),
      ],
      slots: [{ name: 'default', title: 'Content', accepts: ['field', 'layout'] }],
      createNode: ({ id }) => ({ id, kind: 'layout', component: 'element.flex', props: { direction: 'row', wrap: true, gap: 12, justify: 'flex-start', align: 'stretch', itemWidth: 220 }, slots: { default: [] } }),
    },
    locale: {
      title: 'Flex 换行',
      category: '布局',
      setters: { direction: '方向', wrap: '换行', justify: '主轴对齐', align: '交叉轴对齐', gap: '间距', itemWidth: '项目宽度' },
      options: { direction: { row: '横向', column: '纵向' }, justify: { 'flex-start': '起始', 'center': '居中', 'flex-end': '结束', 'space-between': '两端' }, align: { 'flex-start': '起始', 'center': '居中', 'flex-end': '结束', 'stretch': '拉伸' } },
      slots: { default: '内容' },
    },
  },
})
