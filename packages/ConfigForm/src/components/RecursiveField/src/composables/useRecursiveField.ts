import type { ComputedRef } from 'vue'
import type { RecursiveFieldProps } from '../types/props'
import { computed } from 'vue'
import FormComponent from '@/components/FormComponent'
import FormField from '@/components/FormField'
import FormNode from '@/components/FormNode'
import { useFormContext } from '@/composables/useFormContext'
import { isResolvedComponent, isResolvedField } from '@/utils/node'

export interface UseRecursiveFieldResult {
  visible: ComputedRef<boolean>
  resolvedComponent: ComputedRef<typeof FormField | typeof FormComponent | typeof FormNode>
}

/** 组装递归节点的可见性和目标组件分派。 */
export function useRecursiveField(props: RecursiveFieldProps): UseRecursiveFieldResult {
  const ctx = useFormContext()

  /** 当前节点的有效可见性由 useForm 统一解析，隐藏时不再创建下游节点组件。 */
  const visible = computed(() => ctx.isVisible(props.field))

  const resolvedComponent = computed(() => {
    if (isResolvedField(props.field))
      return FormField
    if (isResolvedComponent(props.field))
      return FormComponent
    return FormNode
  })

  return {
    visible,
    resolvedComponent,
  }
}
