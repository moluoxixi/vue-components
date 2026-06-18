import type { ComponentDetailResponse, KnowledgeImportPayload, KnowledgeImportResult } from '../shared/protocol'
import type { ComponentContract } from './types'
import { KNOWLEDGE_IMPORT_PROTOCOL, KNOWLEDGE_IMPORT_PROTOCOL_VERSION } from '../shared/protocol'

export type KnowledgeSource = 'internal' | 'external'

export interface KnowledgeIdentity {
  source: KnowledgeSource
  key: string
}

export function knowledgeKeyOf(source: KnowledgeSource, packageName: string, name: string): string {
  return `${source}:${encodeURIComponent(packageName)}:${encodeURIComponent(name)}`
}

export function parseKnowledgeKey(value: string): KnowledgeIdentity | null {
  const [source, packageName, name] = value.split(':')
  if ((source !== 'internal' && source !== 'external') || !packageName || !name)
    return null
  return { source, key: value }
}

export function contractKnowledgeKey(source: KnowledgeSource, contract: ComponentContract): string {
  return knowledgeKeyOf(source, contract.packageName, contract.name)
}

export function componentDetailToContract(detail: ComponentDetailResponse, source: KnowledgeSource = detail.source ?? 'external'): ComponentContract {
  return {
    name: detail.name,
    packageName: detail.packageName,
    description: detail.description,
    // 外部导入的知识库不读取导出方 docPath，避免把外部机器/仓库路径写入本地契约。
    // 内部扫描仍保留真实 sourceFile，用于本地来源展示与检索辅助。
    sourceFile: source === 'external' ? '' : detail.docPath,
    knowledgeSource: source,
    knowledgeKey: source === 'external'
      ? knowledgeKeyOf(source, detail.packageName, detail.name)
      : detail.knowledgeKey ?? knowledgeKeyOf(source, detail.packageName, detail.name),
    props: detail.props.map(prop => ({
      name: prop.name,
      type: prop.type,
      required: prop.required,
      defaultValue: prop.defaultValue,
      description: prop.description,
      typeRefs: prop.typeRefs,
      ...(prop.forwardedFrom ? { forwardedFrom: prop.forwardedFrom } : {}),
    })),
    emits: detail.emits.map(emit => ({
      name: emit.name,
      payloadType: emit.payloadType,
      description: emit.description,
      typeRefs: emit.typeRefs,
    })),
    slots: detail.slots.map(slot => ({
      name: slot.name,
      scopeType: slot.scopeType,
      description: slot.description,
      typeRefs: slot.typeRefs,
    })),
    models: detail.models.map(model => ({ name: model.name, type: model.type, description: '' })),
    typeDefs: detail.typeDefs.map(typeDef => ({
      name: typeDef.name,
      kind: typeDef.kind,
      fields: typeDef.fields.map(field => ({
        name: field.name,
        type: field.type,
        optional: field.optional,
        description: field.description,
      })),
      raw: typeDef.raw,
    })),
    ...(detail.attrs?.length
      ? {
          attrs: detail.attrs.map(attr => ({
            name: attr.name,
            type: attr.type,
            optional: attr.optional,
            description: attr.description,
          })),
        }
      : {}),
    ...(detail.exposed?.length
      ? {
          exposed: detail.exposed.map(expose => ({
            name: expose.name,
            type: expose.type,
            description: expose.description,
            typeRefs: expose.typeRefs,
          })),
        }
      : {}),
  }
}

export function contractToDetail(contract: ComponentContract, source: KnowledgeSource): ComponentDetailResponse {
  return {
    name: contract.name,
    packageName: contract.packageName,
    description: contract.description,
    docPath: contract.sourceFile,
    source,
    knowledgeKey: contract.knowledgeKey ?? contractKnowledgeKey(source, contract),
    props: contract.props.map(prop => ({
      name: prop.name,
      type: prop.type,
      required: prop.required,
      defaultValue: prop.defaultValue,
      description: prop.description,
      typeRefs: prop.typeRefs,
      ...(prop.forwardedFrom ? { forwardedFrom: prop.forwardedFrom } : {}),
    })),
    emits: contract.emits.map(emit => ({
      name: emit.name,
      payloadType: emit.payloadType,
      description: emit.description,
      typeRefs: emit.typeRefs,
    })),
    slots: contract.slots.map(slot => ({
      name: slot.name,
      scopeType: slot.scopeType,
      description: slot.description,
      typeRefs: slot.typeRefs,
    })),
    models: contract.models.map(model => ({ name: model.name, type: model.type })),
    typeDefs: contract.typeDefs.map(typeDef => ({
      name: typeDef.name,
      kind: typeDef.kind,
      fields: typeDef.fields.map(field => ({
        name: field.name,
        type: field.type,
        optional: field.optional,
        description: field.description,
      })),
      raw: typeDef.raw,
    })),
    ...(contract.attrs?.length
      ? {
          attrs: contract.attrs.map(attr => ({
            name: attr.name,
            type: attr.type,
            optional: attr.optional,
            description: attr.description,
          })),
        }
      : {}),
    ...(contract.exposed?.length
      ? {
          exposed: contract.exposed.map(expose => ({
            name: expose.name,
            type: expose.type,
            description: expose.description,
            typeRefs: expose.typeRefs,
          })),
        }
      : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isArrayField(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function hasOwn(value: object, key: string): boolean {
  return Object.hasOwn(value, key)
}

function assertStringField(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string')
    throw new Error(`invalid import payload: ${path} must be a string`)
}

function assertNonEmptyStringField(value: unknown, path: string): asserts value is string {
  assertStringField(value, path)
  if (!value)
    throw new Error(`invalid import payload: ${path} is required`)
}

function assertBooleanField(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean')
    throw new Error(`invalid import payload: ${path} must be a boolean`)
}

function assertStringOrNullField(value: unknown, path: string): asserts value is string | null {
  if (value !== null && typeof value !== 'string')
    throw new Error(`invalid import payload: ${path} must be a string or null`)
}

function assertStringArrayField(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string'))
    throw new Error(`invalid import payload: ${path} must be a string array`)
}

function assertRecordItem(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!isRecord(value))
    throw new Error(`invalid import payload: ${path} must be an object`)
}

function assertSourceField(value: unknown): void {
  if (value !== undefined && value !== 'internal' && value !== 'external')
    throw new Error('invalid import payload: detail.source must be internal or external')
}

function normalizeImportPayload(payload: KnowledgeImportPayload): ComponentDetailResponse {
  if (!isRecord(payload))
    throw new Error('invalid import payload: JSON object is required')

  if (hasOwn(payload, 'protocol') || hasOwn(payload, 'protocolVersion') || hasOwn(payload, 'kind') || hasOwn(payload, 'detail')) {
    if (payload.protocol !== KNOWLEDGE_IMPORT_PROTOCOL)
      throw new Error(`invalid import payload: protocol must be ${KNOWLEDGE_IMPORT_PROTOCOL}`)
    if (payload.protocolVersion !== KNOWLEDGE_IMPORT_PROTOCOL_VERSION)
      throw new Error(`invalid import payload: protocolVersion must be ${KNOWLEDGE_IMPORT_PROTOCOL_VERSION}`)
    if (payload.kind !== 'component-detail')
      throw new Error('invalid import payload: kind must be component-detail')
    if (!isRecord(payload.detail))
      throw new Error('invalid import payload: detail is required')
    return payload.detail as unknown as ComponentDetailResponse
  }

  return payload as unknown as ComponentDetailResponse
}

export function assertImportPayloadShape(payload: KnowledgeImportPayload): ComponentDetailResponse {
  const detail = normalizeImportPayload(payload)
  if (!isRecord(detail))
    throw new Error('invalid import payload: detail is required')
  assertNonEmptyStringField(detail.name, 'detail.name')
  assertNonEmptyStringField(detail.packageName, 'detail.packageName')
  assertStringField(detail.description, 'detail.description')
  if (detail.docPath !== undefined)
    assertStringField(detail.docPath, 'detail.docPath')
  assertSourceField(detail.source)
  if (detail.knowledgeKey !== undefined)
    assertStringField(detail.knowledgeKey, 'detail.knowledgeKey')
  for (const field of ['props', 'emits', 'slots', 'models', 'typeDefs'] as const) {
    if (!isArrayField(detail[field]))
      throw new Error(`invalid import payload: detail.${field} must be an array`)
  }
  if (detail.attrs !== undefined && !isArrayField(detail.attrs))
    throw new Error('invalid import payload: detail.attrs must be an array')
  if (detail.exposed !== undefined && !isArrayField(detail.exposed))
    throw new Error('invalid import payload: detail.exposed must be an array')

  detail.props.forEach((prop, index) => {
    const path = `detail.props[${index}]`
    assertRecordItem(prop, path)
    assertNonEmptyStringField(prop.name, `${path}.name`)
    assertStringField(prop.type, `${path}.type`)
    assertBooleanField(prop.required, `${path}.required`)
    assertStringOrNullField(prop.defaultValue, `${path}.defaultValue`)
    assertStringField(prop.description, `${path}.description`)
    assertStringArrayField(prop.typeRefs, `${path}.typeRefs`)
    if (prop.forwardedFrom !== undefined)
      assertStringField(prop.forwardedFrom, `${path}.forwardedFrom`)
  })
  detail.emits.forEach((emit, index) => {
    const path = `detail.emits[${index}]`
    assertRecordItem(emit, path)
    assertNonEmptyStringField(emit.name, `${path}.name`)
    assertStringField(emit.payloadType, `${path}.payloadType`)
    assertStringField(emit.description, `${path}.description`)
    assertStringArrayField(emit.typeRefs, `${path}.typeRefs`)
  })
  detail.slots.forEach((slot, index) => {
    const path = `detail.slots[${index}]`
    assertRecordItem(slot, path)
    assertNonEmptyStringField(slot.name, `${path}.name`)
    assertStringField(slot.scopeType, `${path}.scopeType`)
    assertStringField(slot.description, `${path}.description`)
    assertStringArrayField(slot.typeRefs, `${path}.typeRefs`)
  })
  detail.models.forEach((model, index) => {
    const path = `detail.models[${index}]`
    assertRecordItem(model, path)
    assertNonEmptyStringField(model.name, `${path}.name`)
    assertStringField(model.type, `${path}.type`)
  })
  detail.typeDefs.forEach((typeDef, index) => {
    const path = `detail.typeDefs[${index}]`
    assertRecordItem(typeDef, path)
    assertNonEmptyStringField(typeDef.name, `${path}.name`)
    if (typeDef.kind !== 'interface' && typeDef.kind !== 'type')
      throw new Error(`${path}.kind must be interface or type`)
    if (!isArrayField(typeDef.fields))
      throw new Error(`invalid import payload: ${path}.fields must be an array`)
    assertStringField(typeDef.raw, `${path}.raw`)
    typeDef.fields.forEach((field, fieldIndex) => {
      const fieldPath = `${path}.fields[${fieldIndex}]`
      assertRecordItem(field, fieldPath)
      assertNonEmptyStringField(field.name, `${fieldPath}.name`)
      assertStringField(field.type, `${fieldPath}.type`)
      assertBooleanField(field.optional, `${fieldPath}.optional`)
      assertStringField(field.description, `${fieldPath}.description`)
    })
  })
  detail.attrs?.forEach((attr, index) => {
    const path = `detail.attrs[${index}]`
    assertRecordItem(attr, path)
    assertNonEmptyStringField(attr.name, `${path}.name`)
    assertStringField(attr.type, `${path}.type`)
    assertBooleanField(attr.optional, `${path}.optional`)
    assertStringField(attr.description, `${path}.description`)
  })
  detail.exposed?.forEach((expose, index) => {
    const path = `detail.exposed[${index}]`
    assertRecordItem(expose, path)
    assertNonEmptyStringField(expose.name, `${path}.name`)
    assertStringField(expose.type, `${path}.type`)
    assertStringField(expose.description, `${path}.description`)
    assertStringArrayField(expose.typeRefs, `${path}.typeRefs`)
  })
  return detail
}

export function validateKnowledgeImportPayload(payload: KnowledgeImportPayload): ComponentContract {
  const detail = assertImportPayloadShape(payload)
  return componentDetailToContract(detail, 'external')
}

export function importExternalContract(
  payload: KnowledgeImportPayload,
  internals: ComponentContract[],
  externals: ComponentContract[],
  overwrite = false,
): { contracts: ComponentContract[], result: KnowledgeImportResult } {
  const incoming = validateKnowledgeImportPayload(payload)
  const key = contractKnowledgeKey('external', incoming)
  const externalIndex = externals.findIndex(item => contractKnowledgeKey('external', item) === key)
  const internalDuplicate = internals.some(item => contractKnowledgeKey('internal', item) === contractKnowledgeKey('internal', incoming))

  if (externalIndex >= 0 && !overwrite) {
    return {
      contracts: externals,
      result: { status: 'conflict', key, source: 'external', name: incoming.name, packageName: incoming.packageName, conflictsWithInternal: internalDuplicate },
    }
  }

  const next = externals.slice()
  if (externalIndex >= 0)
    next[externalIndex] = incoming
  else
    next.push(incoming)

  return {
    contracts: next,
    result: {
      status: externalIndex >= 0 ? 'overwritten' : 'imported',
      key,
      source: 'external',
      name: incoming.name,
      packageName: incoming.packageName,
      conflictsWithInternal: internalDuplicate,
    },
  }
}
