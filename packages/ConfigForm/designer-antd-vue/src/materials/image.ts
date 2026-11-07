import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'image',
  locale: { title: '图片', category: '展示', setters: { src: '图片地址', alt: '替代文本' } },
  order: 290,
  title: 'Image',
  category: 'Display',
  tag: 'a-image',
  component: shared.AntdDisplayImage,
  props: { src: '', alt: '' },
  resourceBindings: [{ key: 'src', mediaTypes: ['image/*'] }],
  setters: [shared.propSetter('src', 'Source', 'text'), shared.propSetter('alt', 'Alternative text', 'text')],
})
