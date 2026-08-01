import { toDisplayString } from 'vue'

export interface ShadcnOptionNode {
  label: unknown
  value: unknown
}

/** shadcn-vue 选择字段统一通过 props.options 暴露候选项。 */
export function readShadcnOptions(props: Record<string, unknown>): ShadcnOptionNode[] {
  return Array.isArray(props.options) ? props.options.filter(isShadcnOptionNode) : []
}

export function findShadcnOptionLabel(options: readonly ShadcnOptionNode[], value: unknown): unknown | undefined {
  return options.find(option => Object.is(option.value, value))?.label
}

export function joinShadcnLabels(values: readonly unknown[]): string {
  return values.map(value => toDisplayString(value)).join('、')
}

function isShadcnOptionNode(value: unknown): value is ShadcnOptionNode {
  return value !== null
    && typeof value === 'object'
    && 'label' in value
    && 'value' in value
}
