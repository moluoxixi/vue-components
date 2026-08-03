import { withInstall } from '../utils'
import CopyTextSource from './src/index.vue'

export { ClipboardCopyError, copyText } from '../utils/clipboard'
export type * from './src/types'

export const CopyText = withInstall(CopyTextSource)

export default CopyText
