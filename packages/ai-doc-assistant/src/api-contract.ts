import type { ComponentContract, TypeDefInfo } from './core/types'

export type ApiContractSection = 'props' | 'emits' | 'expose' | 'slots'

export interface ApiContractRow {
  name: string
  type: string
  typeDetail?: string
  required?: boolean
  default?: string
  description: string
}

export interface ComponentApiContract {
  name: string
  description: string
  props: ApiContractRow[]
  emits: ApiContractRow[]
  expose: ApiContractRow[]
  slots: ApiContractRow[]
}

export interface ApiTypeDetailInput {
  type: string
  typeDefs: TypeDefInfo[]
  typeRefs: string[]
}

export interface NormalizeComponentApiContractOptions {
  emptyDescription?: string
  resolveTypeDetail?: (input: ApiTypeDetailInput) => string | undefined
}

export function normalizeComponentApiContract(
  contract: ComponentContract,
  options: NormalizeComponentApiContractOptions = {},
): ComponentApiContract {
  const emptyDescription = options.emptyDescription ?? '—'
  const typeDetail = (type: string, typeRefs: string[]): string | undefined => (
    options.resolveTypeDetail?.({ type, typeDefs: contract.typeDefs, typeRefs })
  )

  return {
    name: contract.name,
    description: contract.description,
    props: contract.props.map(prop => ({
      name: prop.name,
      type: prop.type,
      typeDetail: typeDetail(prop.type, prop.typeRefs),
      required: prop.required,
      default: prop.defaultValue && prop.defaultValue !== 'undefined'
        ? prop.defaultValue
        : undefined,
      description: prop.description || emptyDescription,
    })),
    emits: contract.emits.map(emit => ({
      name: emit.name,
      type: emit.payloadType,
      typeDetail: typeDetail(emit.payloadType, emit.typeRefs),
      description: emit.description || emptyDescription,
    })),
    expose: (contract.exposed ?? []).map(exposed => ({
      name: exposed.name,
      type: exposed.type,
      typeDetail: typeDetail(exposed.type, exposed.typeRefs),
      description: exposed.description || emptyDescription,
    })),
    slots: contract.slots.map(slot => ({
      name: slot.name,
      type: slot.scopeType,
      typeDetail: typeDetail(slot.scopeType, slot.typeRefs),
      description: slot.description || emptyDescription,
    })),
  }
}
