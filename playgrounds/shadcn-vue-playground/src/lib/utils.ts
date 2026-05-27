import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 shadcn-vue 组件的静态类和调用方类名。
 *
 * `clsx` 负责条件类名收敛，`tailwind-merge` 负责 Tailwind utility 冲突消解。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
