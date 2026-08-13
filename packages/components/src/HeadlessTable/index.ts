import { withInstall } from '../utils'
import HeadlessTableSource from './src/index.vue'

export { useHeadlessTable, useHeadlessTableMode } from './src/composables'
export {
  createHeadlessTableRenderer,
  createHeadlessTableRendererPlugin,
  defineHeadlessTableRenderer,
  headlessTableRenderer,
  headlessTableRendererKey,
  normalizeHeadlessTableRendererOptions,
  provideHeadlessTableRenderer,
  resolveHeadlessTableRenderer,
} from './src/core'
export type * from './src/types'
export {
  getHeadlessTableColumnId,
  getHeadlessTableColumnLabel,
  getHeadlessTableRawValue,
  projectHeadlessTableColumns,
} from './src/utils'

export const HeadlessTable = withInstall(HeadlessTableSource)

export default HeadlessTable
