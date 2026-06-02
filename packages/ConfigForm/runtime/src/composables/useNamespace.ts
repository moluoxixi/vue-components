import type { ComputedRef, Ref } from 'vue'
import { computed, inject, provide, toValue } from 'vue'

const NAMESPACE_KEY = Symbol('config-form-namespace')

const DEFAULT_NAMESPACE = 'cf'

/** 在 ConfigForm 根组件注入 CSS 命名空间，供字段组件和样式工具复用。 */
export function provideNamespace(namespace: string | Ref<string> | ComputedRef<string>) {
  const ns = computed(() => toValue(namespace) || DEFAULT_NAMESPACE)
  provide(NAMESPACE_KEY, ns)
}

/** 读取最近的 CSS 命名空间；脱离 ConfigForm 使用时回到默认命名空间。 */
export function useNamespace(): ComputedRef<string> {
  return inject(NAMESPACE_KEY, computed(() => DEFAULT_NAMESPACE))
}

/** 基于当前命名空间生成 ConfigForm 使用的 BEM 类名。 */
export function useBem(ns: ComputedRef<string>) {
  /**
   * 生成 block 类名。
   *
   * @example b('form') => 'cf-form'
   */
  function b(block: string): string {
    return `${ns.value}-${block}`
  }

  /**
   * 生成 element 类名。
   *
   * @example e('form', 'label') => 'cf-form__label'
   */
  function e(block: string, element: string): string {
    return `${ns.value}-${block}__${element}`
  }

  /**
   * 生成 modifier 类名。
   *
   * @example m('form', 'inline') => 'cf-form--inline'
   */
  function m(block: string, modifier: string): string {
    return `${ns.value}-${block}--${modifier}`
  }

  return { b, e, m }
}
