import type { ComponentContract } from '../types'
import { z } from 'zod'
import { REGISTRY_CONTRACT_SNAPSHOT_VERSION } from '../constants'
import {
  registryFingerprintSchema,
  registryKeySchema,
  registryVersionSchema,
} from './identity'
import { modelJsonObjectSchema } from './project'

const FORBIDDEN_MEMBER_NAMES = new Set(['__proto__', 'constructor', 'prototype'])
function trimmedString(maximum: number) {
  return z.string()
    .min(1)
    .max(maximum)
    .refine(value => value === value.trim(), 'Value must not contain surrounding whitespace')
}
const memberNameSchema = trimmedString(128).refine(
  name => !FORBIDDEN_MEMBER_NAMES.has(name),
  'Object member name is not allowed',
)
const pathSchema = z.array(memberNameSchema).min(1)
const materialKindSchema = z.enum(['field', 'layout', 'element'])

export const componentContractSchema: z.ZodType<ComponentContract> = z.object({
  key: registryKeySchema,
  version: registryVersionSchema,
  kind: materialKindSchema,
  props: z.array(z.object({
    key: memberNameSchema,
    path: pathSchema,
    valueKind: trimmedString(128).optional(),
    required: z.boolean().optional(),
  }).strict()),
  bindings: z.array(z.object({
    name: memberNameSchema,
    valueProp: memberNameSchema,
    trigger: memberNameSchema,
  }).strict()),
  slots: z.array(z.object({
    name: memberNameSchema,
    accepts: z.array(materialKindSchema).min(1).optional(),
    components: z.array(registryKeySchema).min(1).optional(),
  }).strict()),
  allowedParents: z.array(z.object({
    component: registryKeySchema,
    slot: memberNameSchema,
  }).strict()),
  defaults: modelJsonObjectSchema,
  semanticTriggers: z.array(z.enum(['activate', 'submit', 'rowActivate', 'itemActivate'])),
  stateProjectionProperties: z.array(pathSchema),
  datasetBindings: z.array(z.object({
    key: memberNameSchema,
    projectionKinds: z.array(z.enum(['options', 'table', 'list'])).min(1),
  }).strict()),
  resourceBindings: z.array(z.object({
    key: memberNameSchema,
    mediaTypes: z.array(trimmedString(255)).min(1).optional(),
  }).strict()),
}).strict().superRefine((contract, context) => {
  reportDuplicateRegistryMembers(contract.props, item => item.key, context, ['props'], 'property key')
  reportDuplicateRegistryMembers(contract.bindings, item => item.name, context, ['bindings'], 'binding name')
  reportDuplicateRegistryMembers(contract.slots, item => item.name, context, ['slots'], 'slot name')
  reportDuplicateRegistryMembers(
    contract.allowedParents,
    item => JSON.stringify([item.component, item.slot]),
    context,
    ['allowedParents'],
    'allowed parent',
  )
  reportDuplicateRegistryMembers(contract.semanticTriggers, item => item, context, ['semanticTriggers'], 'semantic trigger')
  reportDuplicateRegistryMembers(
    contract.stateProjectionProperties,
    item => JSON.stringify(item),
    context,
    ['stateProjectionProperties'],
    'state projection path',
  )
  reportDuplicateRegistryMembers(contract.datasetBindings, item => item.key, context, ['datasetBindings'], 'Dataset binding key')
  contract.datasetBindings.forEach((binding, index) => reportDuplicateRegistryMembers(
    binding.projectionKinds,
    item => item,
    context,
    ['datasetBindings', index, 'projectionKinds'],
    'Dataset projection kind',
  ))
  reportDuplicateRegistryMembers(contract.resourceBindings, item => item.key, context, ['resourceBindings'], 'Resource binding key')
  contract.resourceBindings.forEach((binding, index) => reportDuplicateRegistryMembers(
    binding.mediaTypes ?? [],
    item => item,
    context,
    ['resourceBindings', index, 'mediaTypes'],
    'Resource media type',
  ))
  contract.slots.forEach((slot, index) => {
    reportDuplicateRegistryMembers(slot.accepts ?? [], item => item, context, ['slots', index, 'accepts'], 'accepted node kind')
    reportDuplicateRegistryMembers(slot.components ?? [], item => item, context, ['slots', index, 'components'], 'accepted component')
  })
  if (contract.kind !== 'layout' && contract.slots.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Only layout component contracts can define slots.',
      path: ['slots'],
    })
  }
}) as z.ZodType<ComponentContract>

const registryContractComponentSnapshotSchema = z.object({
  key: registryKeySchema,
  contractVersion: registryVersionSchema,
  fingerprint: registryFingerprintSchema,
  contract: componentContractSchema,
}).strict()

export const registryContractSnapshotSchema = z.object({
  version: z.literal(REGISTRY_CONTRACT_SNAPSHOT_VERSION),
  adapter: registryKeySchema,
  adapterVersion: registryVersionSchema,
  fingerprint: registryFingerprintSchema,
  components: z.array(registryContractComponentSnapshotSchema),
}).strict()

function reportDuplicateRegistryMembers<T>(
  values: readonly T[],
  identity: (value: T) => string,
  context: z.RefinementCtx,
  path: Array<string | number>,
  label: string,
): void {
  const seen = new Set<string>()
  values.forEach((value, index) => {
    const key = identity(value)
    if (seen.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate ${label}: ${key}.`,
        path: [...path, index],
      })
    }
    seen.add(key)
  })
}
