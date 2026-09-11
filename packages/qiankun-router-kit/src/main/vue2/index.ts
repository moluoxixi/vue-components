// 主应用 vue2 便利层（vue 2.7 / 2.6 + vue-router 3 + qiankun 运行时）：
//   ./types        vue2 / vue-router 3 的最小结构化类型（为什么不从 'vue' 引见文件头）
//   ./micro-app    MicroApp 挂载器组件（框架无关控制器的 vue2 壳，零 vue import）
//   ./routes       清单 → vue-router 3 路由记录
//   ./main-router  createMainRouter / addMicroApps（上面几件的开箱即用组合）
// 只要框架无关的清单校验和挂载控制器就引 'qiankun-router-kit/main/core'。
//
// 本层没有守卫：坑 B 的镜像守卫只有 vue-router 4/5 需要，原因见 ./main-router 头部。
export * from '../core/index'
export * from './types'
export * from './routes'
export * from './main-router'
export * from './micro-app'
