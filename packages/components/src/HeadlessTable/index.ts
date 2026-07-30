import { withInstall } from '../utils'
import HeadlessTableSource from './src/index.vue'

export { createHeadlessTableRenderer, headlessTableRenderer } from './src/renderer'
export type * from './src/types'

export const HeadlessTable = withInstall(HeadlessTableSource)

export default HeadlessTable
