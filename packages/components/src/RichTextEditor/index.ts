import { withInstall } from '../utils'
import RichTextEditorSource from './src/index.vue'

export type * from './src/types'

export const RichTextEditor = withInstall(RichTextEditorSource)

export default RichTextEditor
