import type { App, Component, Plugin } from 'vue'

export type InstallableConfigFormComponent<T extends Component> = T & Plugin

function getComponentName(component: Component): string | undefined {
  return 'name' in component && typeof component.name === 'string'
    ? component.name
    : undefined
}

/** 为 ConfigForm renderer adapter 补充 Vue 插件安装契约。 */
export function withConfigFormInstall<T extends Component>(
  component: T,
): InstallableConfigFormComponent<T> {
  const install = (app: App): void => {
    const name = getComponentName(component)
    if (!name)
      throw new Error('[ConfigFormRenderer] Component name is required before install.')

    app.component(name, component)
  }

  return Object.assign(component, { install })
}
