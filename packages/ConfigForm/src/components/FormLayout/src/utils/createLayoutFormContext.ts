import type { FormContext } from '@/composables/useFormContext'

/**
 * 创建 FormLayout 子树使用的表单上下文。
 *
 * 该函数只允许覆写布局相关字段，其余状态和行为都实时转发父级，避免 provide 快照导致错误或值失去响应。
 */
export function createLayoutFormContext(
  parentCtx: FormContext,
  overrides: Pick<FormContext, 'inline'>,
): FormContext {
  return {
    get values() { return parentCtx.values },
    get errors() { return parentCtx.errors },
    get inline() { return overrides.inline },
    get labelWidth() { return parentCtx.labelWidth },
    getValue: parentCtx.getValue,
    getValues: parentCtx.getValues,
    isVisible: parentCtx.isVisible,
    isDisabled: parentCtx.isDisabled,
    setValue: parentCtx.setValue,
    setValues: parentCtx.setValues,
    validateField: parentCtx.validateField,
  }
}
