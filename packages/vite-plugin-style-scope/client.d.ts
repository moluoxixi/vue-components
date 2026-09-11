/**
 * `virtual:style-scope` 虚拟模块的类型声明。
 * 在子应用的 tsconfig / env.d.ts 中引入：
 *   /// <reference types="vite-plugin-style-scope/client" />
 */
declare module 'virtual:style-scope' {
  import type { StyleScopeHandle, StyleScopeRuntimeOptions } from 'vite-plugin-style-scope/runtime'

  /** 作用域属性名，默认 data-qiankun（可用 scopeAttr 选项自定义） */
  export const SCOPE_ATTR: string

  /** 作用域属性值，即 appName，如 sub-b */
  export const SCOPE_VALUE: string

  /**
   * 给子应用根容器打作用域标记（qiankun 包裹节点已带同名标记时直接复用），
   * 返回清理句柄；qiankun 环境下默认还会劫持 head / body 的动态插入
   * （可用 patchDom: false 关闭）
   */
  export function applyStyleScope(
    container: Element,
    options?: Pick<StyleScopeRuntimeOptions, 'patchDom'>,
  ): StyleScopeHandle
}
