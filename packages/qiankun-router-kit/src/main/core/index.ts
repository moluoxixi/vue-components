// 主应用框架无关核心：清单归一化与挂载控制器，运行时只依赖 qiankun。
// 各框架便利入口重新导出本层，不在此处引入 Vue 或 React 依赖。
export * from './services'
