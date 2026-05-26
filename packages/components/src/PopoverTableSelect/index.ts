import { withInstall } from '../utils'
import PopoverTableSelectSource from './src/index.vue'

export type * from './src/types'

export const PopoverTableSelect = withInstall(PopoverTableSelectSource)

export default PopoverTableSelect
