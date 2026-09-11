// 主应用 react 便利层（react 16.8+ / 18 + react-router 6 + qiankun 运行时）：
//   ./micro-app    MicroApp 挂载器组件（框架无关控制器的 react 壳，不引 react-router）
//   ./routes       清单 → react-router 6 路由记录
//   ./main-routes  createMainRoutes（主应用路由 + 清单路由，内置 MicroApp）
// 只要框架无关的清单校验和挂载控制器就引 'qiankun-router-kit/main/core'。
//
// 本层没有守卫：坑 B 的镜像守卫只有 vue-router 4/5 需要，原因见 ./main-routes 头部。
export * from '../core/index'
export * from './routes'
export * from './main-routes'
export * from './micro-app'
