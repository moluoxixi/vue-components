import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'empty',
  locale: { title: '空状态', category: '展示', setters: { description: '说明' } },
  order: 310,
  title: 'Empty',
  category: 'Display',
  tag: 'el-empty',
  component: shared.ElementDisplayEmpty,
  props: { description: 'No data' },
  setters: [shared.propSetter('description', 'Description', 'text')],
})
