import { withInstall } from '../utils'
import ElementConfigFormSource from './src/index.vue'

export type * from './src/types'

export const ElementConfigForm = withInstall(ElementConfigFormSource)

export default ElementConfigForm
