export interface ScheduleOptions {
  leading?: boolean
  trailing?: boolean
}

export type ScheduledHandler<T extends (...args: any[]) => void> = (...args: Parameters<T>) => void

/**
 * 创建防抖处理器，用于输入搜索这类高频事件。
 *
 * 默认只在最后一次调用后执行，避免把未完成的输入过程同步给调用方。
 */
export function debounce<T extends (...args: any[]) => void>(
  handler: T,
  wait: number,
  options: ScheduleOptions = {},
): ScheduledHandler<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const leading = options.leading === true
  const trailing = options.trailing !== false

  return (...args: Parameters<T>): void => {
    const shouldCallLeading = leading && timer === undefined
    clearTimeout(timer)

    if (shouldCallLeading)
      handler(...args)

    timer = setTimeout(() => {
      timer = undefined
      if (trailing && !shouldCallLeading)
        handler(...args)
    }, wait)
  }
}

/**
 * 创建节流处理器，用于表格选择这类需要限制触发频率的事件。
 *
 * leading/trailing 语义与常见节流库保持一致，便于迁移旧配置。
 */
export function throttle<T extends (...args: any[]) => void>(
  handler: T,
  wait: number,
  options: ScheduleOptions = {},
): ScheduledHandler<T> {
  let lastRun = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let trailingArgs: Parameters<T> | undefined
  const leading = options.leading !== false
  const trailing = options.trailing !== false

  return (...args: Parameters<T>): void => {
    const now = Date.now()
    const elapsed = now - lastRun

    if (lastRun === 0 && !leading)
      lastRun = now

    if (elapsed >= wait) {
      clearTimeout(timer)
      timer = undefined
      lastRun = now
      handler(...args)
      return
    }

    if (!trailing)
      return

    trailingArgs = args
    clearTimeout(timer)
    timer = setTimeout(() => {
      lastRun = Date.now()
      timer = undefined
      handler(...(trailingArgs as Parameters<T>))
    }, wait - elapsed)
  }
}
