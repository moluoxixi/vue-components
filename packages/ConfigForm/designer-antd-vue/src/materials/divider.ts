import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'divider',
  order: 300,
  title: 'Divider',
  category: 'Display',
  tag: 'a-divider',
  component: shared.AntdDisplayDivider,
  props: { text: '' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
