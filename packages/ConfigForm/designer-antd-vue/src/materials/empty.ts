import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'empty',
  locale: { title: '空状态', category: '展示', setters: { description: '说明' } },
  order: 370,
  title: 'Empty',
  category: 'Display',
  tag: 'a-empty',
  component: shared.AntdDisplayEmpty,
  props: { description: 'No data' },
  setters: [shared.propSetter('description', 'Description', 'text')],
})
