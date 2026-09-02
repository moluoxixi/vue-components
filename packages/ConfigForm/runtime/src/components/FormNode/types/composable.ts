import type { VNodeChild } from 'vue'

export interface UseFormNodeResult {
  renderNode: (attrs?: Record<string, unknown>) => VNodeChild
}
