import { withInstall } from '../utils'
import HeadlessCopyTextSource from './src/index.vue'

export type * from './src/types'

export const HeadlessCopyText = withInstall(HeadlessCopyTextSource)

export default HeadlessCopyText
