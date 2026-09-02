import type { RecursiveFieldProps, UseRecursiveFieldResult } from '../types'
import { computed } from 'vue'
import { useFormContext } from '../../../composables/useFormContext'
import { isResolvedComponent, isResolvedField } from '../../../utils/node'
import FormComponent from '../../FormComponent'
import FormField from '../../FormField'
import FormNode from '../../FormNode'
import ReadonlyField from '../../ReadonlyField'

/** 组装递归节点的可见性和目标组件分派。 */
export function useRecursiveField(props: RecursiveFieldProps): UseRecursiveFieldResult {
  const ctx = useFormContext()

  /** 当前节点的有效可见性由 useForm 统一解析，隐藏时不再创建下游节点组件。 */
  const visible = computed(() => ctx.isVisible(props.field))

  const resolvedComponent = computed(() => {
    if (ctx.isReadonly?.(props.field))
      return ReadonlyField
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
