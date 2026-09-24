import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'icon',
  order: 220,
  title: 'Icon',
  category: 'Display',
  tag: 'span',
  component: shared.ElementDisplayIcon,
  nativeSource: true,
  props: { text: 'i' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
