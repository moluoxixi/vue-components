import type { ModelJsonValue, SurfaceFieldNode } from '@moluoxixi/config-form-model'
import type { RuleDescriptor, RuleSet } from '@moluoxixi/zod3-to-rule'
import type { SchemaImportPreview } from '../types'
import { surfaceNodeSchema } from '@moluoxixi/config-form-model'
import { compileRules } from '@moluoxixi/zod3-to-rule'

const annotations = new Set([
  '$schema',
  '$id',
  '$comment',
  'title',
  'description',
  'examples',
  'default',
  'readOnly',
  'writeOnly',
  'deprecated',
])
const fieldKeywords = new Set([
  'type',
  'enum',
  'const',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
])
const rootKeywords = new Set(['type', 'properties', 'required', 'additionalProperties', '$defs', 'definitions'])
const forbidden = new Set(['__proto__', 'constructor', 'prototype'])

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Offline ingestion into the current model; no remote refs or executable code. */
export function previewJsonSchema(
  input: unknown,
  adapter: 'element-plus' | 'antd-vue',
  existingFields: readonly string[] = [],
  createId: () => string = () => `schema-${crypto.randomUUID()}`,
): SchemaImportPreview {
  const result: SchemaImportPreview = { fields: [], subgraph: { root: [], nodesById: {} }, diagnostics: [] }
  function issue(path: string, message: string, severity: 'error' | 'warning' = 'error'): void {
    result.diagnostics.push({ path, message, severity })
  }
  function keywords(schema: Record<string, unknown>, allowed: Set<string>, path: string): void {
    for (const key of Object.keys(schema)) {
      if (!allowed.has(key) && !annotations.has(key))
        issue(`${path}.${key}`, `Unsupported keyword: ${key}`)
    }
  }
  if (!object(input) || input.type !== 'object' || !object(input.properties)) {
    issue('$', 'Expected an object schema with properties.')
    return result
  }
  keywords(input, rootKeywords, '$')
  const required = input.required ?? []
  if (
    !Array.isArray(required)
    || required.some(key => typeof key !== 'string' || !Object.hasOwn(input.properties as object, key))
  ) {
    issue('$.required', 'Required must contain existing property names.')
    return result
  }
  if (input.additionalProperties !== undefined && typeof input.additionalProperties !== 'boolean')
    issue('$.additionalProperties', 'Schema-valued additional properties are unsupported.')
  if (Object.keys(input.properties).length > 200) {
    issue('$.properties', 'Import at most 200 fields at a time.')
    return result
  }
  const prefix = adapter === 'element-plus' ? 'element' : 'antd'
  for (const [field, schema] of Object.entries(input.properties)) {
    const path = `$.properties[${JSON.stringify(field)}]`
    const before = result.diagnostics.filter(entry => entry.severity === 'error').length
    if (!field.trim() || forbidden.has(field) || existingFields.includes(field)) {
      issue(path, existingFields.includes(field) ? `Field already exists: ${field}` : 'Unsafe or empty field name.')
      continue
    }
    if (!object(schema)) {
      issue(path, 'Expected a property schema object.')
      continue
    }
    const property = schema
    keywords(schema, fieldKeywords, path)
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    const nullable = types.includes('null')
    const actualTypes = types.filter(type => type !== 'null')
    const type = actualTypes[0]
    if (actualTypes.length !== 1 || !['string', 'number', 'integer', 'boolean'].includes(String(type))) {
      issue(
        `${path}.type`,
        'Supported types: string, number, integer, boolean, optionally nullable. Objects, arrays and unions need manual design.',
      )
      continue
    }
    const rules: RuleDescriptor[] = []
    let base: RuleSet['base'] = { type: type === 'integer' ? 'number' : (type as 'string' | 'number' | 'boolean') }
    let component = `${prefix}.${type === 'boolean' ? 'switch' : type === 'string' ? 'input' : 'input-number'}`
    const props: SurfaceFieldNode['props'] = {}
    if (schema.enum !== undefined) {
      if (
        type !== 'string'
        || !Array.isArray(schema.enum)
        || !schema.enum.length
        || schema.enum.some(value => typeof value !== 'string')
      ) {
        issue(`${path}.enum`, 'Visual enum import currently supports non-empty string enums.')
      }
      else {
        base = { type: 'enum', values: [...schema.enum] as [string, ...string[]] }
        component = `${prefix}.select`
        props.options = schema.enum.map(value => ({ label: value, value }))
      }
    }
    if (schema.const !== undefined) {
      const matches
        = type === 'string'
          ? typeof schema.const === 'string'
          : type === 'boolean'
            ? typeof schema.const === 'boolean'
            : typeof schema.const === 'number' && (type !== 'integer' || Number.isInteger(schema.const))
      if (!matches || schema.enum !== undefined)
        issue(`${path}.const`, 'Const must match the primitive type and cannot be combined with enum.')
      else base = { type: 'literal', value: schema.const as string | number | boolean }
    }
    function numeric(
      key: string,
      kind: 'min' | 'max' | 'minLength' | 'maxLength' | 'multipleOf',
      inclusive = true,
    ): void {
      if (property[key] === undefined)
        return
      const value = property[key]
      if (
        typeof value !== 'number'
        || !Number.isFinite(value)
        || (kind.endsWith('Length') && (!Number.isInteger(value) || value < 0))
        || (kind === 'multipleOf' && value <= 0)
      ) {
        issue(`${path}.${key}`, `Invalid ${key}.`)
        return
      }
      if (
        (kind.endsWith('Length') && type !== 'string')
        || (!kind.endsWith('Length') && type !== 'number' && type !== 'integer')
      ) {
        issue(`${path}.${key}`, `Keyword ${key} does not match the field type.`)
        return
      }
      rules.push(kind === 'min' || kind === 'max' ? { kind, value, inclusive } : ({ kind, value } as RuleDescriptor))
    }
    numeric('minLength', 'minLength')
    numeric('maxLength', 'maxLength')
    numeric('minimum', 'min')
    numeric('maximum', 'max')
    numeric('exclusiveMinimum', 'min', false)
    numeric('exclusiveMaximum', 'max', false)
    numeric('multipleOf', 'multipleOf')
    if (type === 'integer')
      rules.push({ kind: 'integer' })
    if (schema.pattern !== undefined) {
      if (type !== 'string' || typeof schema.pattern !== 'string') {
        issue(`${path}.pattern`, 'Pattern requires a string field and string pattern.')
      }
      else {
        try {
          const pattern = new RegExp(schema.pattern)
          rules.push({ kind: 'regex', source: pattern.source })
        }
        catch {
          issue(`${path}.pattern`, 'Invalid regular expression.')
        }
      }
    }
    if (schema.format !== undefined) {
      if (type === 'string' && ['email', 'uri', 'uuid'].includes(String(schema.format)))
        rules.push({ kind: schema.format === 'uri' ? 'url' : (schema.format as 'email' | 'uuid') })
      else issue(`${path}.format`, `Unsupported format: ${String(schema.format)}. It will not be validated.`, 'warning')
    }
    if (schema.readOnly === true)
      props.readonly = true
    const validation: RuleSet = {
      version: 2,
      base,
      rules,
      optional: !required.includes(field),
      ...(nullable ? { nullable: true } : {}),
    }
    const compiled = compileRules(validation)
    for (const diagnostic of compiled.diagnostics) issue(path, diagnostic.message, diagnostic.severity)
    if (schema.default !== undefined && !compiled.schema.safeParse(schema.default).success)
      issue(`${path}.default`, 'Default value does not satisfy the field schema.')
    if (result.diagnostics.filter(entry => entry.severity === 'error').length > before)
      continue
    const node: SurfaceFieldNode = {
      id: createId(),
      kind: 'field',
      component,
      field,
      label: typeof schema.title === 'string' ? schema.title : field,
      ...(typeof schema.description === 'string' ? { description: schema.description } : {}),
      ...(schema.default !== undefined ? { defaultValue: schema.default as ModelJsonValue } : {}),
      required: required.includes(field),
      validation,
      props,
    }
    const parsed = surfaceNodeSchema.safeParse(node)
    if (!parsed.success) {
      issue(path, parsed.error.issues[0]?.message ?? 'Invalid field contract.')
      continue
    }
    result.fields.push(node)
    result.subgraph.nodesById[node.id] = node
    result.subgraph.root.push({ nodeId: node.id, placement: { span: 24 } })
  }
  return result
}
