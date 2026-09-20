import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'icon',
  order: 280,
  title: 'Icon',
  category: 'Display',
  tag: 'span',
  component: shared.AntdDisplayIcon,
  nativeSource: true,
  props: { text: 'i' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
