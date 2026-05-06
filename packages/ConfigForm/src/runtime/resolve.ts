import type { DefinedFormNodeConfig, NormalizedFieldConfig, NormalizedNodeConfig, ResolvedFormNode, SlotContent } from '@/types'
import type { ComponentRegistry, FormRuntimeResolveSnap, FormRuntimeResolveHelpers, FormRuntimeTokenResolver } from './types'
import type { TransformContext } from './transform'
import { isVNode } from 'vue'
import { hasFieldBinding } from './guards'
import { isRuntimeToken } from './token'
import { isDefinedFormNodeConfig, isFormNodeConfig, isResolvedFormNodeConfig, markResolvedFormNodeConfig } from '@/models/node'

export interface ResolveContext {
  resolveNode: (node: DefinedFormNodeConfig, snap: FormRuntimeResolveSnap, path?: string) => ResolvedFormNode
  resolveValue: <TValue = unknown>(value: TValue, snap: FormRuntimeResolveSnap, path?: string) => unknown
  resolveVisible: (node: DefinedFormNodeConfig, snap: FormRuntimeResolveSnap) => boolean
  resolveDisabled: (node: DefinedFormNodeConfig, snap: FormRuntimeResolveSnap) => boolean
  resolveSlot: (slot: SlotContent, resolveSnap: FormRuntimeResolveSnap, path?: string) => SlotContent
}

export function createResolvers(
  components: ComponentRegistry,
  tokenResolvers: Record<string, FormRuntimeTokenResolver>,
  transform: TransformContext,
): ResolveContext {
  // --- resolveComponent ---
  function resolveComponent(component: NormalizedNodeConfig['component']): NormalizedNodeConfig['component'] {
    if (typeof component === 'string' && Object.hasOwn(components, component))
      return components[component]
    if (typeof component === 'string' && /^[A-Z]/.test(component))
      throw new Error(`Unknown component key: ${component}`)
    return component
  }

  // --- resolveValue ---
  function resolveValue<TValue = unknown>(
    value: TValue,
    resolveSnap: FormRuntimeResolveSnap,
    path = 'value',
  ): unknown {
    let resolved: unknown = value

    if (isRuntimeToken(resolved)) {
      const resolver = tokenResolvers[resolved.__configFormToken]
      if (!resolver)
        throw new Error(`No token resolver registered for token type: ${resolved.__configFormToken}`)
      resolved = resolver(resolved, resolveSnap, path, { resolveValue } as FormRuntimeResolveHelpers)
    }
    else if (Array.isArray(resolved)) {
      resolved = resolved.map((item, index) => resolveValue(item, resolveSnap, `${path}.${index}`))
    }
    else if (isPlainRecord(resolved)) {
      resolved = Object.fromEntries(
        Object.entries(resolved).map(([key, item]) => [
          key,
          resolveValue(item, resolveSnap, `${path}.${key}`),
        ]),
      )
    }

    return resolved
  }

  // --- resolveSlot（内部函数） ---
  function resolveSlot(slot: SlotContent, resolveSnap: FormRuntimeResolveSnap, path = 'slot'): SlotContent {
    if (typeof slot === 'function') {
      return (scope?: Record<string, unknown>) => resolveSlot(
        slot(scope, resolveSnap),
        { ...resolveSnap, slotScope: scope },
        path,
      )
    }

    if (Array.isArray(slot))
      return slot.map((item, index) => resolveSlot(item as SlotContent, resolveSnap, `${path}.${index}`)) as SlotContent

    if (isFormNodeConfig(slot)) {
      if (isResolvedFormNodeConfig(slot))
        return slot
      if (!isDefinedFormNodeConfig(slot))
        throw new Error(`Slot node at "${path}" must be created with defineField()`)
      return resolveNode(slot, resolveSnap, path) as SlotContent
    }

    return resolveValue(slot, resolveSnap, path) as SlotContent
  }

  // --- resolveNode（统一入口） ---
  function resolveNode(node: DefinedFormNodeConfig, snap: FormRuntimeResolveSnap, path = 'node'): ResolvedFormNode {
    if (isResolvedFormNodeConfig(node))
      return node

    const transformed = transform.transformNode(node)
    const nodeSnap = hasFieldBinding(transformed)
      ? { ...snap, field: transformed as NormalizedFieldConfig }
      : snap

    return markResolvedFormNodeConfig({
      ...transformed,
      component: resolveComponent(transformed.component),
      label: hasFieldBinding(transformed) && (transformed as NormalizedFieldConfig).label != null
        ? String(resolveValue((transformed as NormalizedFieldConfig).label, nodeSnap, `${(transformed as NormalizedFieldConfig).field}.label`))
        : (transformed as NormalizedFieldConfig).label,
      props: Object.fromEntries(
        Object.entries(transformed.props).map(([key, item]) => [
          key,
          resolveValue(item, nodeSnap, `${path}.props.${key}`),
        ]),
      ),
      slots: transformed.slots
        ? Object.fromEntries(
          Object.entries(transformed.slots).map(([key, slot]) => [
            key,
            resolveSlot(slot, { ...nodeSnap, slotName: key }, `${path}.slots.${key}`),
          ]),
        )
        : transformed.slots,
    } as ResolvedFormNode)
  }

  // --- resolveVisible ---
  function resolveVisible(node: DefinedFormNodeConfig, snap: FormRuntimeResolveSnap): boolean {
    const transformed = transform.transformNode(node)
    const nodeSnap = hasFieldBinding(transformed)
      ? { ...snap, field: transformed as NormalizedFieldConfig }
      : snap
    const condition = (transformed as NormalizedFieldConfig).visible
    if (condition == null) return true
    if (typeof condition === 'boolean') return condition
    if (isRuntimeToken<boolean>(condition))
      return Boolean(resolveValue(condition, nodeSnap, 'condition'))
    return condition(nodeSnap.values)
  }

  // --- resolveDisabled ---
  function resolveDisabled(node: DefinedFormNodeConfig, snap: FormRuntimeResolveSnap): boolean {
    const transformed = transform.transformNode(node)
    const nodeSnap = hasFieldBinding(transformed)
      ? { ...snap, field: transformed as NormalizedFieldConfig }
      : snap
    const condition = (transformed as NormalizedFieldConfig).disabled
    if (condition == null) return false
    if (typeof condition === 'boolean') return condition
    if (isRuntimeToken<boolean>(condition))
      return Boolean(resolveValue(condition, nodeSnap, 'condition'))
    return condition(nodeSnap.values)
  }

  return { resolveNode, resolveValue, resolveVisible, resolveDisabled, resolveSlot }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false
  if (isVNode(value))
    return false
  if ((value as Record<string, unknown>).__v_skip || (value as Record<string, unknown>).setup || (value as Record<string, unknown>).render || (value as Record<string, unknown>).template || (value as Record<string, unknown>).__vccOpts)
    return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
