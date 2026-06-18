import { withInstall } from '../utils'
import ConfigTableSource from './src/index.vue'

export type * from './src/types'

export const ConfigTable = withInstall(ConfigTableSource)

export default ConfigTable
