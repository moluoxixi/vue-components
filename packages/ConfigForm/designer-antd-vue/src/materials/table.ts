import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'table',
  locale: { title: '表格', category: '数据', setters: { } },
  order: 350,
  title: 'Table',
  category: 'Data',
  tag: 'a-table',
  component: shared.AntdDatasetTable,
  props: { rows: [] },
  semanticTriggers: ['rowActivate'],
  nativeSource: true,
  sourceRender: 'dataset-table',
  datasetBindings: [{ key: 'rows', projectionKinds: ['table'] }],
})
