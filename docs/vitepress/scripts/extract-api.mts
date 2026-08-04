#!/usr/bin/env node

import type { ComponentContract } from '@moluoxixi/ai-doc-assistant'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ServerContext } from '@moluoxixi/ai-doc-assistant'
import { documentedComponentNames } from '../.vitepress/component-manifest.ts'

interface ApiRow {
  name: string
  type: string
  typeDetail?: string
  required?: boolean
  default?: string
  description: string
}

interface ComponentApi {
  name: string
  description: string
  props: ApiRow[]
  emits: ApiRow[]
  expose: ApiRow[]
  slots: ApiRow[]
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '../../..')
const outDir = resolve(scriptDir, '../.vitepress/api')

function referencedTypeDefs(contract: ComponentContract, refs: string[]): ComponentContract['typeDefs'] {
  const availableNames = new Set(contract.typeDefs.map(definition => definition.name))
  const selectedNames = new Set(refs.filter(ref => availableNames.has(ref)))

  let changed = true
  while (changed) {
    changed = false
    for (const definition of contract.typeDefs) {
      if (!selectedNames.has(definition.name))
        continue

      const identifiers = definition.raw.match(/[a-z_$][\w$]*/gi) ?? []
      for (const identifier of identifiers) {
        if (!availableNames.has(identifier) || selectedNames.has(identifier))
          continue
        selectedNames.add(identifier)
        changed = true
      }
    }
  }

  return contract.typeDefs.filter(definition => selectedNames.has(definition.name))
}

function typeDetail(contract: ComponentContract, type: string, refs: string[]): string | undefined {
  const referenced = referencedTypeDefs(contract, refs)
  if (referenced.length === 0)
    return type.length > 42 ? type : undefined

  const definitions = referenced.map((definition) => {
    const raw = definition.raw.replace(/\r\n/g, '\n')
    if (raw.length <= 1800)
      return raw

    const fields = definition.fields.slice(0, 14).map((field) => {
      const optional = field.optional ? '?' : ''
      return `  ${field.name}${optional}: ${field.type}`
    })
    const remaining = definition.fields.length - fields.length
    if (remaining > 0)
      fields.push(`  // ... ${remaining} more fields`)
    return `${definition.kind} ${definition.name} {\n${fields.join('\n')}\n}`
  })

  return [type, ...definitions].join('\n\n')
}

function normalizeContract(contract: ComponentContract): ComponentApi {
  return {
    name: contract.name,
    description: contract.description,
    props: contract.props.map(prop => ({
      name: prop.name,
      type: prop.type,
      typeDetail: typeDetail(contract, prop.type, prop.typeRefs),
      required: prop.required,
      default: prop.defaultValue && prop.defaultValue !== 'undefined' ? prop.defaultValue : undefined,
      description: prop.description || '—',
    })),
    emits: contract.emits.map(emit => ({
      name: emit.name,
      type: emit.payloadType,
      typeDetail: typeDetail(contract, emit.payloadType, emit.typeRefs),
      description: emit.description || '—',
    })),
    expose: (contract.exposed ?? []).map(exposed => ({
      name: exposed.name,
      type: exposed.type,
      typeDetail: typeDetail(contract, exposed.type, exposed.typeRefs),
      description: exposed.description || '—',
    })),
    slots: contract.slots.map(slot => ({
      name: slot.name,
      type: slot.scopeType,
      typeDetail: typeDetail(contract, slot.scopeType, slot.typeRefs),
      description: slot.description || '—',
    })),
  }
}

async function main(): Promise<void> {
  const context = new ServerContext({
    root,
    componentEntries: ['packages/components/index.ts'],
    mode: 'content',
  })

  await context.buildIndex()
  const contracts = new Map(context.getContracts().map(contract => [contract.name, contract]))
  const missing = documentedComponentNames.filter(name => !contracts.has(name))

  if (missing.length > 0)
    throw new Error(`ai-doc-assistant did not extract: ${missing.join(', ')}`)

  mkdirSync(outDir, { recursive: true })

  for (const name of documentedComponentNames) {
    const api = normalizeContract(contracts.get(name)!)
    const outPath = resolve(outDir, `${name}.json`)
    writeFileSync(outPath, `${JSON.stringify(api, null, 2)}\n`, 'utf-8')
    console.log(`generated ${name}.json`)
  }

  console.log(`Generated API contracts for ${documentedComponentNames.length} components with ai-doc-assistant.`)
}

main().catch((error: unknown) => {
  console.error('API extraction failed.')
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
