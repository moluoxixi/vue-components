// 主应用 vue3 便利层（vue + vue-router 4/5 + qiankun 运行时）：
//   ./micro-app    MicroApp 挂载器组件（框架无关控制器的 vue3 壳）
//   ./routes       清单 → vue-router 路由记录
//   ./guard        坑 B 的主应用镜像守卫（只有 vue-router 4/5 需要）
//   ./main-router  createMainRouter / addMicroApps（上面三件的开箱即用组合）
// 只要框架无关的清单校验和挂载控制器就引 'qiankun-router-kit/main/core'。
export * from '../core/index'
export * from './routes'
export * from './guard'
export * from './main-router'
export * from './micro-app'
