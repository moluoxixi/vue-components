import type { ComputedRef } from 'vue'
import type FormComponent from '../../FormComponent'
import type FormField from '../../FormField'
import type FormNode from '../../FormNode'

export interface UseRecursiveFieldResult {
  visible: ComputedRef<boolean>
  resolvedComponent: ComputedRef<typeof FormField | typeof FormComponent | typeof FormNode>
}
