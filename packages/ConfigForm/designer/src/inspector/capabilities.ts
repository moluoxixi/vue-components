import type { ComponentContract, PageNode } from '@moluoxixi/config-form-model'
import type {
  DesignerMaterialDefinition,
  DesignerPropertySetterDefinition,
} from '../registry'

export const INSPECTOR_SECTION_IDS = [
  'properties',
  'validation',
  'events',
  'bindings',
  'conditions',
  'reactions',
] as const

export type InspectorSectionId = typeof INSPECTOR_SECTION_IDS[number]

export interface InspectorNodeCapabilityInput {
  node: PageNode
  material?: DesignerMaterialDefinition
  contract?: ComponentContract
}

export interface InspectorSectionProjection {
  id: InspectorSectionId
  canCreate: boolean
  editable: boolean
  hasStoredContent: boolean
}

export type InspectorStaleConfigKind
  = | 'binding-unknown'
    | 'condition-inapplicable'
    | 'event-unknown'
    | 'selection-incompatible'
    | 'validation-incompatible'

export interface InspectorStaleConfigRemoval {
  kind: 'delete-path'
  path: string[]
}

export interface InspectorStaleConfigItem {
  kind: InspectorStaleConfigKind
  section: Exclude<InspectorSectionId, 'properties'>
  nodeId: string
  nodeComponent: string
  key: string
  path: string[]
  reason: 'metadata-missing' | 'not-applicable' | 'not-declared' | 'selection-incompatible'
  removal: InspectorStaleConfigRemoval | null
  value: unknown
}

export interface InspectorProjection {
  sections: InspectorSectionProjection[]
  commonSetters: DesignerPropertySetterDefinition[]
  commonEvents: ComponentContract['events']
  commonBindings: ComponentContract['bindings']
  commonConditionTargets: Array<'visible' | 'hidden' | 'required' | 'disabled' | 'readonly'>
  staleItems: InspectorStaleConfigItem[]
}

const FIELD_CONDITION_TARGETS = ['visible', 'hidden', 'required', 'disabled', 'readonly'] as const
const LAYOUT_CONDITION_TARGETS = ['visible', 'hidden'] as const

export function resolveInspectorCapabilities(
  inputs: readonly InspectorNodeCapabilityInput[],
): InspectorProjection {
  const hasWritableEvidence = inputs.length > 0 && inputs.every(input => (
    validMaterial(input) !== undefined && validContract(input) !== undefined
  ))
  const commonSetters = hasWritableEvidence ? intersectSetters(inputs) : []
  const commonEvents = intersectEvents(inputs)
  const commonBindings = intersectBindings(inputs)
  const commonConditionTargets = intersectConditionTargets(inputs)
  const validationCompatible = compatibleValidationSelection(inputs)
  const stored = storedSections(inputs)
  const canCreate = {
    properties: inputs.length > 0,
    validation: inputs.length > 0 && inputs.every(input => input.node.kind === 'field'),
    events: commonEvents.length > 0,
    bindings: commonBindings.length > 0,
    conditions: commonConditionTargets.length > 0,
    reactions: inputs.length === 1,
  } satisfies Record<InspectorSectionId, boolean>

  return {
    sections: INSPECTOR_SECTION_IDS.flatMap((id) => {
      const hasStoredContent = stored[id]
      return id === 'properties' || canCreate[id] || hasStoredContent
        ? [{
            id,
            canCreate: canCreate[id],
            editable: canCreate[id]
              && hasWritableEvidence
              && (id !== 'validation' || validationCompatible),
            hasStoredContent,
          }]
        : []
    }),
    commonSetters,
    commonEvents,
    commonBindings,
    commonConditionTargets,
    staleItems: collectStaleItems(
      inputs,
      new Set(commonEvents.map(event => event.name)),
      commonBindings,
      new Set(commonConditionTargets),
      hasWritableEvidence,
      validationCompatible,
    ),
  }
}

function storedSections(inputs: readonly InspectorNodeCapabilityInput[]): Record<InspectorSectionId, boolean> {
  return {
    properties: inputs.length > 0,
    validation: inputs.some(({ node }) => node.kind === 'field'
      && (node.validation !== undefined || node.validateOn !== undefined)),
    events: inputs.some(({ node }) => Object.keys(node.events).length > 0),
    bindings: inputs.some(({ node }) => Object.keys(node.bindings).length > 0),
    conditions: inputs.some(({ node }) => Object.keys(node.conditions ?? {}).length > 0),
    reactions: inputs.some(({ node }) => (node.reactions?.length ?? 0) > 0),
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
    return firstForPath && inputs.slice(1).every((input) => {
      const material = validMaterial(input)
      if (!material)
        return false
      return material.setters.some(candidate => compatibleSetter(setter, candidate))
    })
  })
}

function intersectEvents(inputs: readonly InspectorNodeCapabilityInput[]): ComponentContract['events'] {
  const first = validContract(inputs[0])
  if (!first)
    return []
  const common = first.events.filter(event => inputs.slice(1).every((input) => {
    const contract = validContract(input)
    return contract?.events.some(candidate => candidate.name === event.name) ?? false
  }))
  return common.map(event => ({ ...event }))
}

function intersectBindings(inputs: readonly InspectorNodeCapabilityInput[]): ComponentContract['bindings'] {
  const first = validContract(inputs[0])
  if (!first)
    return []
  const common = first.bindings.filter(binding => inputs.slice(1).every((input) => {
    const contract = validContract(input)
    return contract?.bindings.some(candidate => compatibleBinding(binding, candidate)) ?? false
  }))
  return common.map(binding => ({ ...binding }))
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

function intersectConditionTargets(
  inputs: readonly InspectorNodeCapabilityInput[],
): InspectorProjection['commonConditionTargets'] {
  const first = inputs[0]
  if (!first)
    return []
  const candidates = conditionTargets(first.node)
  return candidates.filter(target => inputs.slice(1)
    .every(input => conditionTargets(input.node).includes(target)))
}

function conditionTargets(node: PageNode): InspectorProjection['commonConditionTargets'] {
  return node.kind === 'field' ? [...FIELD_CONDITION_TARGETS] : [...LAYOUT_CONDITION_TARGETS]
}

function collectStaleItems(
  inputs: readonly InspectorNodeCapabilityInput[],
  commonEventNames: ReadonlySet<string>,
  commonBindings: ComponentContract['bindings'],
  commonConditionTargets: ReadonlySet<string>,
  hasWritableEvidence: boolean,
  validationCompatible: boolean,
): InspectorStaleConfigItem[] {
  const multiple = inputs.length > 1
  return inputs.flatMap((input) => {
    const contract = validContract(input)
    const declaredEvents = new Set(contract?.events.map(event => event.name) ?? [])
    const declaredBindings = contract?.bindings ?? []
    const applicableConditions = new Set(conditionTargets(input.node))
    const items: InspectorStaleConfigItem[] = []

    Object.keys(input.node.events).sort().forEach((key) => {
      const declared = declaredEvents.has(key)
      if (!declared || (multiple && !commonEventNames.has(key))) {
        items.push(staleItem(input, {
          key,
          kind: declared ? 'selection-incompatible' : 'event-unknown',
          path: ['events', key],
          reason: declared
            ? 'selection-incompatible'
            : contract ? 'not-declared' : 'metadata-missing',
          removal: removalFor(hasWritableEvidence, ['events', key]),
          section: 'events',
          value: input.node.events[key],
        }))
      }
    })

    Object.keys(input.node.bindings).sort().forEach((key) => {
      const declared = declaredBindings.find(binding => binding.name === key)
      const common = declared && commonBindings.some(binding => compatibleBinding(binding, declared))
      if (!declared || (multiple && !common)) {
        items.push(staleItem(input, {
          key,
          kind: declared ? 'selection-incompatible' : 'binding-unknown',
          path: ['bindings', key],
          reason: declared
            ? 'selection-incompatible'
            : contract ? 'not-declared' : 'metadata-missing',
          removal: removalFor(hasWritableEvidence, ['bindings', key]),
          section: 'bindings',
          value: input.node.bindings[key],
        }))
      }
    })

    Object.keys(input.node.conditions ?? {}).sort().forEach((key) => {
      const applicable = applicableConditions.has(key as never)
      if (!applicable || (multiple && !commonConditionTargets.has(key))) {
        items.push(staleItem(input, {
          key,
          kind: applicable ? 'selection-incompatible' : 'condition-inapplicable',
          path: ['conditions', key],
          reason: applicable ? 'selection-incompatible' : 'not-applicable',
          removal: removalFor(hasWritableEvidence, ['conditions', key]),
          section: 'conditions',
          value: input.node.conditions?.[key as keyof NonNullable<PageNode['conditions']>],
        }))
      }
    })

    if (multiple) {
      input.node.reactions?.forEach((reaction) => {
        items.push(staleItem(input, {
          key: reaction.id,
          kind: 'selection-incompatible',
          path: ['reactions'],
          reason: 'selection-incompatible',
          removal: null,
          section: 'reactions',
          value: reaction,
        }))
      })
    }
    if (input.node.kind === 'field' && (!hasWritableEvidence || !validationCompatible)) {
      const reason = hasWritableEvidence ? 'selection-incompatible' : 'metadata-missing'
      if (input.node.validation !== undefined) {
        items.push(staleItem(input, {
          key: 'validation',
          kind: 'validation-incompatible',
          path: ['validation'],
          reason,
          removal: removalFor(hasWritableEvidence, ['validation']),
          section: 'validation',
          value: input.node.validation,
        }))
      }
      if (input.node.validateOn !== undefined) {
        items.push(staleItem(input, {
          key: 'validateOn',
          kind: 'validation-incompatible',
          path: ['validateOn'],
          reason,
          removal: removalFor(hasWritableEvidence, ['validateOn']),
          section: 'validation',
          value: input.node.validateOn,
        }))
      }
    }
    return items
  })
}

function compatibleValidationSelection(inputs: readonly InspectorNodeCapabilityInput[]): boolean {
  if (inputs.length <= 1)
    return true
  const first = inputs[0]?.node
  if (first?.kind !== 'field')
    return false
  return inputs.slice(1).every(({ node }) => node.kind === 'field'
    && contractValueEqual(first.validation, node.validation)
    && contractValueEqual(first.validateOn, node.validateOn))
}

function removalFor(
  enabled: boolean,
  path: string[],
): InspectorStaleConfigRemoval | null {
  return enabled ? { kind: 'delete-path', path } : null
}

function staleItem(
  input: InspectorNodeCapabilityInput,
  item: Omit<InspectorStaleConfigItem, 'nodeComponent' | 'nodeId'>,
): InspectorStaleConfigItem {
  return {
    ...item,
    nodeComponent: input.node.component,
    nodeId: input.node.id,
  }
}

function compatibleBinding(
  left: ComponentContract['bindings'][number],
  right: ComponentContract['bindings'][number],
): boolean {
  return left.name === right.name
    && left.valueProp === right.valueProp
    && left.trigger === right.trigger
}

function compatibleSetter(
  left: DesignerPropertySetterDefinition,
  right: DesignerPropertySetterDefinition,
): boolean {
  return samePath(left.path, right.path)
    && left.control === right.control
    && left.valueKind === right.valueKind
    && left.min === right.min
    && left.max === right.max
    && left.step === right.step
    && samePath(left.optionsPath, right.optionsPath)
    && samePath(left.optionSourcePath, right.optionSourcePath)
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
