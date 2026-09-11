// 主应用侧的框架无关核心（入口 `qiankun-router-kit/main/core`），运行时只依赖 qiankun：
//   ./manifest    qiankun 官方清单的类型、校验/归一化、activeRule → 前缀推导
//   ./controller  无 UI 的挂载控制器（串行队列、地址栏归属、路由模式判定、挂载点解析）
// 这一层不引 vue、不引 react、也不引任何 router 实现，所以能给任意框架写壳。
//
// 开箱即用的那层按主应用自己的技术栈引一个（各自 re-export 本层，一个路径就够）：
//   qiankun-router-kit/main/vue3    vue3 + vue-router 4/5
//   qiankun-router-kit/main/vue2    vue2 + vue-router 3
//   qiankun-router-kit/main/react   react + react-router 6
// 每层都提供 MicroApp 壳、对应 router 的 createMicroAppRoutes 与便利函数。
//
// 坑 B 的主应用镜像守卫（installMainRouterGuard）在 ../vue3 —— 只有 vue-router 4/5
// 会读写 history.state.current，vue-router 3 与 react-router 6 都不读它，
// 那两层不提供守卫是对的，不是漏做。
export * from './manifest'
export * from './controller'
