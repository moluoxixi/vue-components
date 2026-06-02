import type { VNodeChild } from 'vue'
import type { FormNodeProps } from '../types/props'
import type {
  RenderContext,
  RenderFunction,
  RenderSlotInvoker,
  ResolvedSlotContent,
} from '@/types'
import { cloneVNode, computed, h, isVNode, mergeProps } from 'vue'
import RecursiveField from '@/components/RecursiveField'
import { useFormContext } from '@/composables/useFormContext'
import { getResolvedNodeRenderKey } from '@/utils/slot'
import { mergeStyleValues, readStyleValue } from '@/utils/style'

export interface UseFormNodeResult {
  renderNode: (attrs?: Record<string, unknown>) => VNodeChild
}

/**
 * 组装单个 ConfigForm 节点的 render 上下文。
 *
 * 这里只做本节点私有的 attrs、listener、slot 和 render-function 分流；
 * 字段值、错误、可见性和禁用态仍然统一来自 useFormContext。
 */
export function useFormNode(props: FormNodeProps): UseFormNodeResult {
  const ctx = useFormContext()

  /** 容器节点在 grid 模式下使用 runtime 已补齐的 span。 */
  const containerStyle = computed(() => {
    if (ctx.inline)
      return undefined
    if ('field' in props.field)
      return undefined
    return { gridColumn: `span ${props.field.span}` }
  })

  const attrs = computed(() => {
    const baseStyle = containerStyle.value
    const existingStyle = readStyleValue(props.field.props?.style)
    const componentStyle = readStyleValue(props.componentAttrs?.style, 'componentAttrs.style')
    return {
      ...props.field.props,
      ...(props.componentAttrs ?? {}),
      style: mergeStyleValues(baseStyle, existingStyle, componentStyle),
    }
  })

  /**
   * render function 使用 h() 调用组件时需要 onXxx 形态的事件键。
   *
   * 这里保留字段声明中的事件语义，只做 Vue render props 所需的键名映射。
   */
  const listenerAttrs = computed(() => {
    const listeners = props.componentListeners ?? {}
    return Object.fromEntries(
      Object.entries(listeners).map(([name, handler]) => [toVueListenerKey(name), handler]),
    )
  })

  /** attrs 同时包含值绑定、布局属性和事件监听，供 render 函数直接透传给 h()。 */
  const renderAttrs = computed(() => ({
    ...attrs.value,
    ...listenerAttrs.value,
  }))

  function createRenderContext(): RenderContext {
    const context: RenderContext = {
      get attrs() { return renderAttrs.value },
      get errors() { return ctx.errors },
      get values() { return ctx.values },
      get slots() { return createSlotInvokers(context) },
      getValue: ctx.getValue,
      getValues: ctx.getValues,
      isDisabled: ctx.isDisabled,
      isReadonly: ctx.isReadonly ?? (() => false),
      isVisible: ctx.isVisible,
      node: props.field,
      setValue: ctx.setValue,
      setValues: ctx.setValues,
      validateField: ctx.validateField,
    }

    return context
  }

  function createSlotInvokers(context: RenderContext): Record<string, RenderSlotInvoker> | undefined {
    const slots = props.field.slots
    if (!slots)
      return undefined

    return Object.fromEntries(
      Object.entries(slots).map(([slotName, slot]) => [
        slotName,
        (...args: unknown[]) => renderSlotContent(slot, context, slotName, slotName, args),
      ]),
    )
  }

  function renderSlotContent(
    content: ResolvedSlotContent,
    context: RenderContext,
    slotName: string,
    path: string,
    args: unknown[],
  ): VNodeChild {
    if (Array.isArray(content)) {
      return content.map((item, index) =>
        renderSlotContent(item, context, slotName, `${path}.${index}`, args),
      )
    }

    if (typeof content === 'function')
      return content(context, ...args) as VNodeChild

    return h(RecursiveField, {
      field: content,
      key: getResolvedNodeRenderKey(content, `${slotName}.${path}`),
    })
  }

  function createVueSlots(context: RenderContext): Record<string, RenderSlotInvoker> | undefined {
    const slotInvokers = context.slots
    if (!slotInvokers)
      return undefined

    return Object.fromEntries(
      Object.entries(slotInvokers).map(([slotName, invoker]) => [
        slotName,
        (...args: unknown[]) => invoker(...args),
      ]),
    )
  }

  return {
    renderNode: (fallthroughAttrs: Record<string, unknown> = {}) => {
      const attrs = mergeProps(fallthroughAttrs, renderAttrs.value)
      const context = createRenderContext()
      const component = props.field.component
      const vueSlots = createVueSlots(context)
      const hasFallthroughAttrs = Object.keys(fallthroughAttrs).length > 0

      if (typeof component === 'function') {
        const rendered = (component as RenderFunction)(context)
        return hasFallthroughAttrs && isVNode(rendered)
          ? cloneVNode(rendered, fallthroughAttrs)
          : rendered
      }

      if (typeof component === 'string')
        return h(component, attrs, vueSlots?.default?.() ?? undefined)

      return h(component, attrs, vueSlots)
    },
  }
}

function toVueListenerKey(name: string): string {
  return `on${capitalizeEventName(name.split(':').map(camelizeEventSegment).join(':'))}`
}

function camelizeEventSegment(value: string): string {
  return value
    .split('-')
    .map((segment, index) => (index === 0 ? segment : capitalizeEventName(segment)))
    .join('')
}

function capitalizeEventName(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
