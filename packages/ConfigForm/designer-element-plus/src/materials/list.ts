import * as shared from './shared'

export default shared.defineElementBusinessMaterial({
  name: 'list',
  locale: { title: '列表', category: '数据', setters: { } },
  order: 300,
  title: 'List',
  category: 'Data',
  tag: 'div',
  component: shared.ElementDatasetList,
  nativeSource: true,
  props: { items: [] },
  semanticTriggers: ['itemActivate'],
  sourceRender: 'dataset-list',
  datasetBindings: [{ key: 'items', projectionKinds: ['list'] }],
})
