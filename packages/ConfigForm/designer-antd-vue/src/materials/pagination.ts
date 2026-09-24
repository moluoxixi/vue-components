import * as shared from './shared'

export default shared.defineAntdBusinessMaterial({
  name: 'pagination',
  order: 380,
  title: 'Pagination',
  category: 'Data',
  tag: 'a-pagination',
  component: shared.AntdDisplayPagination,
  props: { total: 0, pageSize: 10 },
  setters: [shared.propSetter('total', 'Total', 'number', undefined, { min: 0, step: 1 }), shared.propSetter('pageSize', 'Page size', 'number', undefined, { min: 1, step: 1 })],
})
