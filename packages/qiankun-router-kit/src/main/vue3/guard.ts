// 坑 B 的主应用那一半镜像守卫。只有 vue-router 4/5 需要它，所以放在 vue3 层：
// vue-router 3 的导航不读 history.state.current，react-router 6 直接整份替换
// state（{ usr, key, idx }），两者都不会被子应用写入的方言误伤。
import type { Router } from 'vue-router'
import { getFullPath, getStateCurrent, setStateCurrent } from '../../utils'

/**
 * 主应用守卫（坑 B 的一半）：vue-router 4/5 的 push 会先拿共享的
 * history.state.current 去 replaceState 当前记录，而 vue-router 4 子应用写入的
 * current 是相对它自己 base 的路径。导航前把 current 归一化成完整路径，
 * 主应用读到的永远是自己的坐标系。
 *
 * 只在主应用（base=/）安装一次；子应用侧的镜像守卫内置在 ../../sub/vue3 的
 * createSubRouter 里。用 ./main-router 的 createMainRouter 的话这一步已被吃掉。
 */
export function installMainRouterGuard(router: Router): Router {
  router.beforeEach(() => {
    const fullPath = getFullPath()
    if (window.history.state && getStateCurrent() !== fullPath)
      setStateCurrent(fullPath)
  })
  return router
}
