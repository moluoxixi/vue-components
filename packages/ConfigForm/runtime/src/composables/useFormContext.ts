import type { FormContext } from '../types'
import { inject, provide } from 'vue'
import { ConfigFormError } from '../errors'

export const FORM_CONTEXT_KEY = Symbol.for('moluoxixi.config-form.form-context')

/** 在 ConfigForm 根层提供表单状态和操作，供 RecursiveField 注入。 */
export function provideFormContext(context: FormContext): void {
  provide(FORM_CONTEXT_KEY, context)
}

/** 递归组件注入表单状态；若不在表单上下文中则抛错。 */
export function useFormContext(): FormContext {
  const ctx = inject<FormContext>(FORM_CONTEXT_KEY)
  if (!ctx) {
    throw new ConfigFormError(
      'CONFIG_FORM_MISSING_CONTEXT',
      'FormContext not provided. Are you inside a <ConfigForm>?',
    )
  }
  return ctx
}
