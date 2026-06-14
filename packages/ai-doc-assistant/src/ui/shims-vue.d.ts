/** Vue SFC 模块声明：让 TS 识别 .vue import（UI SPA 构建用）。 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

/**
 * 本地 workspace 组件库运行时模块声明。
 * demo 预览块通过 vite alias 将其解析到 packages/components/dist 实体；
 * 此处仅为 TS 提供命名空间形态（运行时真实导出由 alias 提供）。
 */
declare module '@moluoxixi/components' {
  const components: Record<string, unknown>
  export = components
}

/** 组件库样式副作用模块（仅用于触发样式注入，无运行时导出）。 */
declare module '@moluoxixi/components/styles' {}

/** vue3-sfc-loader 浏览器 ESM 构建的最小类型声明（仅声明本项目使用的 loadModule）。 */
declare module 'vue3-sfc-loader/dist/vue3-sfc-loader.esm.js' {
  import type { Component } from 'vue'

  export function loadModule(path: string, options: unknown): Promise<Component>
}
