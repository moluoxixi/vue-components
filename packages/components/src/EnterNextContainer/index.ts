import { withInstall } from '../utils'
import EnterNextContainerSource from './src/index.vue'

export type * from './src/types'

export const EnterNextContainer = withInstall(EnterNextContainerSource)

export default EnterNextContainer
