import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'alert',
  order: 340,
  title: 'Alert',
  category: 'Display',
  tag: 'a-alert',
  component: shared.AntdDisplayAlert,
  props: { title: 'Alert', description: '', type: 'info', showIcon: true },
  setters: [shared.propSetter('title', 'Title', 'text'), shared.propSetter('description', 'Description', 'textarea'), shared.propSetter('type', 'Type', 'text'), shared.propSetter('showIcon', 'Show icon', 'boolean')],
})
