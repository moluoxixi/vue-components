/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, any>
  export default component
}

/** vue3-sfc-loader 包 exports 未暴露类型声明，playground 仅使用 loadModule。 */
declare module 'vue3-sfc-loader' {
  import type { Component } from 'vue'

  export function loadModule(path: string, options: unknown): Promise<Component>
}
