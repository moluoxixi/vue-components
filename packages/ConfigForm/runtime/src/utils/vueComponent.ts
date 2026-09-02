import type {
  Component,
  EmitsOptions,
  FunctionalComponent,
} from 'vue'
import type { AdaptedVueFunctionalComponent } from '../types'
import { defineComponent, h, markRaw } from 'vue'

/**
 * 将 Vue 函数组件包装成对象组件，避免与 ConfigForm RenderFunction 的函数协议混淆。
 */
export function asVueFunctionalComponent<
  TProps extends object,
  TEmits extends EmitsOptions | Record<string, any[]> = Record<never, never>,
  TSlots extends Record<string, any> = any,
>(
  component: FunctionalComponent<TProps, TEmits, TSlots>,
): AdaptedVueFunctionalComponent<TProps, TEmits, TSlots> {
  return markRaw(defineComponent({
    name: component.displayName || component.name || 'ConfigFormFunctionalComponent',
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      return () => h(component as Component, attrs, slots)
    },
  })) as unknown as AdaptedVueFunctionalComponent<TProps, TEmits, TSlots>
}
