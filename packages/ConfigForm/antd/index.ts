import type { InstallableComponent } from '@moluoxixi/config-form-core'
import type { Component } from 'vue'
import { withInstall } from '@moluoxixi/config-form-core'
import AntdConfigFormSource from './src/index.vue'

export type * from './src/types'

const AntdConfigFormComponent = AntdConfigFormSource as Component

export const antdConfigForm: InstallableComponent<Component> = withInstall(AntdConfigFormComponent)
export const AntdConfigForm: InstallableComponent<Component> = antdConfigForm

export default antdConfigForm
