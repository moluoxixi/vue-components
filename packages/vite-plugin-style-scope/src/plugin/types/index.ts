export interface StyleScopeOptions {
  /** 子应用名，作为作用域属性的值，需与 qiankun 注册的 name 保持一致 */
  appName: string
  /**
   * 是否给 node_modules 里的样式（组件库）也加前缀。
   * 默认 false —— 组件库的类名冲突应该用 Element Plus namespace / antd prefixCls 根治，
   * 靠前缀处理会让产物膨胀，且组件库自己 teleport 出去的元素依然打不到。
   */
  includeDeps?: boolean
  /**
   * 是否在 qiankun 环境下劫持 head / body 的动态插入（默认 true）：
   * 动态 <style> / <link> 改挂到 <qiankun-head>、body 上的弹窗改挂到子应用容器。
   * 也可在调用 applyStyleScope 时按次覆盖。
   */
  patchDom?: boolean
  /**
   * 扩展选项：自定义作用域属性名，默认 `data-qiankun` ——
   * qiankun 开启 experimentalStyleIsolation 时会给子应用包裹节点打上
   * `data-qiankun="<appName>"`，默认值让前缀直接复用 qiankun 自己的标记，
   * 无需运行时额外打属性。仅在需要避开 qiankun 语义时才自定义。
   */
  scopeAttr?: string
}
