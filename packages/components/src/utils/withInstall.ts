import type { App, Component, Plugin } from 'vue'

export type InstallableComponent<T extends Component> = T & Plugin

/**
 * 为单个组件补充 Vue 插件安装契约。
 *
 * 组件必须通过 defineOptions 声明稳定 name，缺失 name 时让 Vue 注册阶段直接暴露错误。
 */
export function withInstall<T extends Component>(component: T): InstallableComponent<T> {
  const install = (app: App): void => {
    app.component((component as { name: string }).name, component)
  }

  return Object.assign(component, { install })
}
