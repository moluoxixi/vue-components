import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'title',
  locale: { title: '标题', category: '展示', setters: { text: '文本', level: '标题级别' } },
  order: 210,
  title: 'Title',
  category: 'Display',
  tag: 'h2',
  component: shared.ElementDisplayTitle,
  nativeSource: true,
  props: { text: 'Title', level: 2 },
  setters: [shared.propSetter('text', 'Text', 'text'), shared.propSetter('level', 'Level', 'number', undefined, { min: 1, max: 6, step: 1 })],
})
