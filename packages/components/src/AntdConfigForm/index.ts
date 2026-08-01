import { withInstall } from '../utils'
import AntdConfigFormSource from './src/index.vue'

export type * from './src/types'

export const antdConfigForm = withInstall(AntdConfigFormSource)
export const AntdConfigForm = antdConfigForm

export default antdConfigForm
