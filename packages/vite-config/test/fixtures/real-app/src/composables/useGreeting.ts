/**
 * 生成真实 app fixture 的稳定文案，用于确认构建产物来自业务源码。
 */
export function createGreeting(label: string): string {
  return `hello ${label}`
}
