import { withInstall } from '../utils'
import RequestTreeSelectSource from './src/index.vue'

export const RequestTreeSelect = withInstall(RequestTreeSelectSource)

export type * from './src/types'

export default RequestTreeSelect
