import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'icon',
  locale: { title: '图标', category: '展示', setters: { text: '文本' } },
  order: 220,
  title: 'Icon',
  category: 'Display',
  tag: 'span',
  component: shared.ElementDisplayIcon,
  nativeSource: true,
  props: { text: 'i' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
