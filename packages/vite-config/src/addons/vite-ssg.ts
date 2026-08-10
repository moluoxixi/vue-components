import type { UserConfig } from 'vite'

export type ViteSsgAddonOptions = UserConfig & {
  ssgOptions?: {
    beastiesOptions?: {
      reduceInlineStyles?: boolean
    }
    formatting?: string
    onFinished?: () => void | Promise<void>
    script?: string
  }
}

/**
 * 让 vite-ssg 配置获得本 preset 支持的 SSG 配置类型提示。
 */
export function defineViteSsgAddonOptions(options: ViteSsgAddonOptions): ViteSsgAddonOptions {
  return options
}
