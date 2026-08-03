import { withInstall } from '../utils'
import HeadlessTableSource from './src/index.vue'

export {
  getHeadlessTableColumnId,
  getHeadlessTableColumnLabel,
  getHeadlessTableRawValue,
} from './src/core'
export {
  createHeadlessTableRenderer,
  defineHeadlessTableRenderer,
  headlessTableRenderer,
  headlessTableRendererKey,
  provideHeadlessTableRenderer,
} from './src/renderer'
export type * from './src/types'
export { useHeadlessTable } from './src/useHeadlessTable'

export const HeadlessTable = withInstall(HeadlessTableSource)

export default HeadlessTable
