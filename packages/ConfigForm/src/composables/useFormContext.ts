import type { FormErrors, FormValues } from '@/types'
import { inject, provide } from 'vue'

export interface FormContext {
  values: FormValues
  errors: FormErrors
  visibilityMap: Record<string, boolean>
  disabledMap: Record<string, boolean>
  inline?: boolean
  labelWidth?: string | number
  getValue: (field: string) => unknown
  getValues: () => FormValues
  setValue: (field: string, value: unknown) => void
  setValues: (values: FormValues, replace?: boolean) => void
  validateField: (field: string, trigger: string) => Promise<boolean>
}

export const FORM_CONTEXT_KEY = Symbol.for('moluoxixi.config-form.form-context')

/** 在 ConfigForm 根层提供表单状态和操作，供 RecursiveField 注入。 */
export function provideFormContext(context: FormContext): void {
  provide(FORM_CONTEXT_KEY, context)
}

/** 递归组件注入表单状态；若不在表单上下文中则抛错。 */
export function useFormContext(): FormContext {
  const ctx = inject<FormContext>(FORM_CONTEXT_KEY)
  if (!ctx)
    throw new Error('FormContext not provided. Are you inside a <ConfigForm>?')
  return ctx
}
