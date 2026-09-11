// 浏览器共享 history.state 的读写工具。
// 注意在带局部 history 变量的作用域（如 vue-router 的 history 对象）里
// 引用这些函数，能避免变量遮蔽踩坑 —— 这里显式只操作 window.history。

/** 当前地址栏完整路径（pathname + search + hash） */
export function getFullPath(): string {
  return window.location.pathname + window.location.search + window.location.hash
}

/** 读共享 history.state 上的 current 字段（vue-router 4 写入，其他 router 可能没有） */
export function getStateCurrent(): string | undefined {
  const state = window.history.state
  return state && typeof state.current === 'string' ? state.current : undefined
}

/** 就地改写 current（replaceState，不新增历史记录），保留 state 其余字段 */
export function setStateCurrent(current: string): void {
  window.history.replaceState({ ...window.history.state, current }, '')
}
