export interface ScheduleOptions {
  leading?: boolean
  trailing?: boolean
}

export interface ScheduledHandler<T extends (...args: any[]) => void> {
  (...args: Parameters<T>): void
  /** 取消尚未触发的 trailing 调用，用于组件卸载或调度配置切换。 */
  cancel: () => void
  /** 立即触发当前 pending 的 trailing 调用，保持最后一次参数语义。 */
  flush: () => void
}

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
  let lastArgs: Parameters<T> | undefined
  let pendingTrailing = false
  const leading = options.leading === true
  const trailing = options.trailing !== false

  const scheduled = ((...args: Parameters<T>): void => {
    const shouldCallLeading = leading && timer === undefined
    lastArgs = args
    clearTimeout(timer)

    if (shouldCallLeading)
      handler(...args)

    pendingTrailing = trailing && !shouldCallLeading
    timer = setTimeout(() => {
      timer = undefined
      if (pendingTrailing) {
        pendingTrailing = false
        handler(...(lastArgs as Parameters<T>))
      }
    }, wait)
  }) as ScheduledHandler<T>

  scheduled.cancel = () => {
    clearTimeout(timer)
    timer = undefined
    lastArgs = undefined
    pendingTrailing = false
  }

  scheduled.flush = () => {
    if (timer === undefined)
      return

    clearTimeout(timer)
    timer = undefined
    if (pendingTrailing) {
      pendingTrailing = false
      handler(...(lastArgs as Parameters<T>))
    }
  }

  return scheduled
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

  function run(args: Parameters<T>): void {
    lastRun = Date.now()
    trailingArgs = undefined
    handler(...args)
  }

  const scheduled = ((...args: Parameters<T>): void => {
    const now = Date.now()

    if (lastRun === 0 && !leading)
      lastRun = now

    const elapsed = now - lastRun
    if (elapsed >= wait) {
      clearTimeout(timer)
      timer = undefined
      run(args)
      return
    }

    if (!trailing)
      return

    trailingArgs = args
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      run(trailingArgs as Parameters<T>)
    }, wait - elapsed)
  }) as ScheduledHandler<T>

  scheduled.cancel = () => {
    clearTimeout(timer)
    timer = undefined
    trailingArgs = undefined
  }

  scheduled.flush = () => {
    if (timer === undefined)
      return

    clearTimeout(timer)
    timer = undefined
    run(trailingArgs as Parameters<T>)
  }

  return scheduled
}
