import type { Options } from '@vitejs/plugin-react'

export type ReactAddonOptions = Options

/**
 * 让 React addon 配置获得 @vitejs/plugin-react 原生类型提示。
 */
export function defineReactAddonOptions(options: ReactAddonOptions): ReactAddonOptions {
  return options
}
