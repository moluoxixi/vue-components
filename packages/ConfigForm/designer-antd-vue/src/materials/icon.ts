import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'icon',
  locale: { title: '图标', category: '展示', setters: { text: '文本' } },
  order: 280,
  title: 'Icon',
  category: 'Display',
  tag: 'span',
  component: shared.AntdDisplayIcon,
  nativeSource: true,
  props: { text: 'i' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
