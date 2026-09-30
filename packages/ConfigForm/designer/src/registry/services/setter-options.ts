import type { DeepReadonly, ProjectDataset, SurfaceNode } from '@moluoxixi/config-form-model'
import type { DesignerOptionValueType, DesignerPropertySetterDefinition, DesignerSetterOption } from '../types'
import { queryDatasetView } from '@moluoxixi/config-form-model'
import { cloneDesignerJson } from '../../graph'
import { DESIGNER_OPTION_VALUE_TYPES } from '../../options'

export function isDesignerOptionValueAllowed(setter: DesignerPropertySetterDefinition, value: unknown): boolean {
  return (setter.optionValueTypes ?? DESIGNER_OPTION_VALUE_TYPES).includes(typeof value as DesignerOptionValueType)
    && (typeof value !== 'number' || Number.isFinite(value))
}

/** Resolve the same option source that Runtime uses, without copying it into the graph. */
export function resolveDesignerSetterOptions(
  node: object & Partial<Pick<SurfaceNode, 'datasetBindings'>>,
  setter: DesignerPropertySetterDefinition,
  datasets: readonly DeepReadonly<ProjectDataset>[] = [],
): DesignerSetterOption[] | undefined {
  let value: unknown = setter.options
  if (setter.optionsPath) {
    const [root, bindingKey, ...remainingPath] = setter.optionsPath
    const reference = root === 'props' && bindingKey ? node.datasetBindings?.[bindingKey] : undefined
    let path = setter.optionsPath
    value = node
    if (reference) {
      const dataset = datasets.find(candidate => candidate.id === reference.datasetId)
      // Missing/invalid Dataset references have their own Model/Runtime diagnostics.
      // An unresolved source must never be treated as an empty static option list.
      if (!dataset || reference.projection.kind !== 'options')
        return undefined
      const projected = queryDatasetView(dataset, cloneDesignerJson(reference.projection), reference.query)
      if (!projected.success)
        return undefined
      value = projected.data.items
      path = remainingPath
    }
    for (const segment of path) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        value = undefined
        break
      }
      value = (value as Record<string, unknown>)[segment]
    }
  }
  else if (!setter.options) {
    return undefined
  }
  if (!Array.isArray(value))
    return []
  return value.flatMap((option) => {
    if (typeof option !== 'object' || option === null || Array.isArray(option))
      return []
    const record = option as Record<string, unknown>
    if (typeof record.label !== 'string' || !Object.hasOwn(record, 'value') || !isDesignerOptionValueAllowed(setter, record.value))
      return []
    return [{ label: record.label, value: record.value as string | number | boolean }]
  })
}
