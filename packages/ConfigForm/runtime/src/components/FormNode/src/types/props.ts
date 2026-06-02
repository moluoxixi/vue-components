import type { ResolvedFormNode } from '@/types'

/** FormNode 允许注入到最终组件上的监听器映射。 */
export interface FormNodeComponentListeners {
  [event: string]: (...args: unknown[]) => Promise<boolean> | void
}

/** FormNode 作为内部渲染入口接收的节点契约。 */
export interface FormNodeProps {
  field: ResolvedFormNode
  componentAttrs?: Record<string, unknown>
  componentListeners?: FormNodeComponentListeners
}
