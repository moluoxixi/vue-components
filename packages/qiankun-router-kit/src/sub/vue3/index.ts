// vue-router 4 子应用入口：router 创建/销毁 + 一站式 defineSubApp，
// 并 re-export 框架无关的 ../index（resolveRouterConfig 与类型）
export * from '../core/index'
export * from './router'
export * from './define-app'
