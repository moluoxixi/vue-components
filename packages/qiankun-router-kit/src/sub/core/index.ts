// 子应用侧的框架无关核心（入口 `qiankun-router-kit/sub/core`）：vue2 / react 子应用
// 直接用它拿配置，vue3 子应用用包好的 ../vue3。本文件不 import 任何 router 实现，
// 也不引 qiankun，所以子应用产物里不会多出一份主应用的运行时。

export * from './services'
export type * from './types'
