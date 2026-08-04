#!/usr/bin/env node

import type { ComponentContract } from '@moluoxixi/ai-doc-assistant'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ServerContext } from '@moluoxixi/ai-doc-assistant'
import { documentedComponentNames, documentedComponents } from '../.vitepress/component-manifest.ts'
import { syncApiOutputDirectory } from './api-output.mts'
import { createTypeDetail } from './api-type-detail.mts'
import { createComponentRoutePaths } from './component-routes.mts'

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

function normalizeContract(contract: ComponentContract): ComponentApi {
  return {
    name: contract.name,
    description: contract.description,
    props: contract.props.map(prop => ({
      name: prop.name,
      type: prop.type,
      typeDetail: createTypeDetail(contract.typeDefs, prop.type, prop.typeRefs),
      required: prop.required,
      default: prop.defaultValue && prop.defaultValue !== 'undefined' ? prop.defaultValue : undefined,
      description: prop.description || '—',
    })),
    emits: contract.emits.map(emit => ({
      name: emit.name,
      type: emit.payloadType,
      typeDetail: createTypeDetail(contract.typeDefs, emit.payloadType, emit.typeRefs),
      description: emit.description || '—',
    })),
    expose: (contract.exposed ?? []).map(exposed => ({
      name: exposed.name,
      type: exposed.type,
      typeDetail: createTypeDetail(contract.typeDefs, exposed.type, exposed.typeRefs),
      description: exposed.description || '—',
    })),
    slots: contract.slots.map(slot => ({
      name: slot.name,
      type: slot.scopeType,
      typeDetail: createTypeDetail(contract.typeDefs, slot.scopeType, slot.typeRefs),
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
  const routeResult = createComponentRoutePaths({
    root,
    components: documentedComponents,
  })

  const documentedNames = new Set(documentedComponentNames)
  const missing = documentedComponentNames.filter(name => !contracts.has(name))
  const undocumented = Array.from(contracts.keys()).filter(name => !documentedNames.has(name)).sort()

  if (missing.length > 0)
    throw new Error(`ai-doc-assistant did not extract: ${missing.join(', ')}`)
  if (undocumented.length > 0)
    throw new Error(`public components missing from documentation manifest: ${undocumented.join(', ')}`)

  for (const name of routeResult.apiOnly)
    console.log(`validated API-only route for ${name}`)

  const removedApiFiles = syncApiOutputDirectory(outDir, documentedComponentNames)
  for (const file of removedApiFiles)
    console.log(`removed stale API contract ${file}`)

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
