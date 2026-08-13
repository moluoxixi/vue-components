import { withInstall } from '../utils'
import HeadlessCopyTextSource from './src/index.vue'

export { useClipboardCopy } from '../composables'
export type { UseClipboardCopyOptions, UseClipboardCopyReturn } from '../composables'
export type * from './src/types'

export const HeadlessCopyText = withInstall(HeadlessCopyTextSource)

export default HeadlessCopyText
