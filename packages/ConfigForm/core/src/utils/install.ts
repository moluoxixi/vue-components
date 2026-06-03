import type { App, Component, Plugin } from 'vue'

export type InstallableComponent<T extends Component> = T & Plugin

/**
 * 为单个 ConfigForm UI 组件补充 Vue 插件安装契约。
 *
 * 组件必须通过 defineOptions 声明稳定 name；缺失时在 install 阶段抛出明确错误。
 */
export function withInstall<T extends Component>(component: T): InstallableComponent<T> {
  const install = (app: App): void => {
    const name = (component as { name?: string }).name
    if (!name)
      throw new Error('[ConfigFormCore] Component name is required before install.')

    app.component(name, component)
  }

  return Object.assign(component, { install })
}
