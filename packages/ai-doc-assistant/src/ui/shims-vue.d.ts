/** Vue SFC 模块声明：让 TS 识别 .vue import（UI SPA 构建用）。 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
