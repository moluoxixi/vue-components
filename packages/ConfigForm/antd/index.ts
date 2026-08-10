import { withConfigFormInstall } from '@moluoxixi/config-form/renderer'
import AntdConfigFormSource from './src/index.vue'

export { ANTD_CONFIG_FORM_COMPONENTS } from './src/components'
export type * from './src/types'

export const antdConfigForm = withConfigFormInstall(AntdConfigFormSource)
export const AntdConfigForm = antdConfigForm

export default antdConfigForm
