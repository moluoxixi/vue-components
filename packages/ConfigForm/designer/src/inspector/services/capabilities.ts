import type { ComponentContract } from '@moluoxixi/config-form-model'
import type {
  DesignerMaterialDefinition,
  DesignerPropertySetterDefinition,
} from '../../registry'
import type {
  InspectorNodeCapabilityInput,
  InspectorProjection,
} from '../types'
import { isDesignerSetterPathAllowed } from '../../graph'
import { INSPECTOR_SECTION_IDS } from '../constants'

export function resolveInspectorCapabilities(
  inputs: readonly InspectorNodeCapabilityInput[],
): InspectorProjection {
  const hasWritableEvidence = inputs.length > 0 && inputs.every(input => (
    validMaterial(input) !== undefined && validContract(input) !== undefined
  ))

  return {
    sections: INSPECTOR_SECTION_IDS.map(id => ({
      id,
      canCreate: id === 'properties'
        ? inputs.length > 0
        : id === 'interactions'
          ? inputs.length === 1
          : inputs.length > 0 && inputs.every(input => input.node.kind === 'field'),
      editable: hasWritableEvidence && (id === 'properties'
        || (id === 'interactions'
          ? inputs.length === 1
          : inputs.every(input => input.node.kind === 'field'))),
      hasStoredContent: id === 'properties'
        ? inputs.length > 0
        : id === 'interactions'
          ? false
          : inputs.some(({ node }) => node.kind === 'field'
            && (node.required !== undefined
              || node.requiredMessage !== undefined
              || node.validation !== undefined
              || node.validateOn !== undefined)),
    })),
    commonSetters: hasWritableEvidence ? intersectSetters(inputs) : [],
  }
}

function intersectSetters(
  inputs: readonly InspectorNodeCapabilityInput[],
): DesignerPropertySetterDefinition[] {
  const first = inputs[0]
  const firstMaterial = first ? validMaterial(first) : undefined
  if (!firstMaterial)
    return []

  return firstMaterial.setters.filter((setter, index, setters) => {
    const firstForPath = setters.findIndex(candidate => samePath(candidate.path, setter.path)) === index
    return firstForPath
      && isDesignerSetterPathAllowed(setter.path)
      && inputs.slice(1).every((input) => {
        const material = validMaterial(input)
        if (!material)
          return false
        return material.setters.some(candidate => compatibleSetter(setter, candidate))
      })
  })
}

function validContract(input: InspectorNodeCapabilityInput | undefined): ComponentContract | undefined {
  if (!input?.contract)
    return undefined
  return input.contract.kind === input.node.kind && input.contract.key === input.node.component
    ? input.contract
    : undefined
}

function validMaterial(input: InspectorNodeCapabilityInput): DesignerMaterialDefinition | undefined {
  return input.material?.kind === input.node.kind && input.material.key === input.node.component
    ? input.material
    : undefined
}

function compatibleSetter(
  left: DesignerPropertySetterDefinition,
  right: DesignerPropertySetterDefinition,
): boolean {
  return isDesignerSetterPathAllowed(right.path)
    && samePath(left.path, right.path)
    && left.control === right.control
    && left.valueKind === right.valueKind
    && left.min === right.min
    && left.max === right.max
    && left.step === right.step
    && samePath(left.optionsPath, right.optionsPath)
    && left.component === right.component
    && contractValueEqual(left.componentProps, right.componentProps)
    && optionsEqual(left.options, right.options)
}

function optionsEqual(
  left: DesignerPropertySetterDefinition['options'],
  right: DesignerPropertySetterDefinition['options'],
): boolean {
  if (left === undefined || right === undefined)
    return left === right
  return left.length === right.length && left.every((option, index) => {
    const candidate = right[index]
    return candidate !== undefined
      && option.label === candidate.label
      && contractValueEqual(option.value, candidate.value)
  })
}

function samePath(left: readonly string[] | undefined, right: readonly string[] | undefined): boolean {
  if (left === undefined || right === undefined)
    return left === right
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

function contractValueEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right))
    return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => contractValueEqual(value, right[index]))
  }
  if (!isRecord(left) || !isRecord(right))
    return false
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return samePath(leftKeys, rightKeys)
    && leftKeys.every(key => contractValueEqual(left[key], right[key]))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
