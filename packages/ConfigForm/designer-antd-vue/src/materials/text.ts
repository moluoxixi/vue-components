import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'text',
  order: 260,
  title: 'Text',
  category: 'Display',
  tag: 'a-typography-text',
  component: shared.AntdDisplayText,
  props: { text: 'Text' },
  setters: [shared.propSetter('text', 'Text', 'text')],
})
