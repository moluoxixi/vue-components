#!/usr/bin/env node

import type { ComponentContract } from '@moluoxixi/ai-doc-assistant'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ServerContext } from '@moluoxixi/ai-doc-assistant'
import { documentedComponentNames, documentedComponents } from '../.vitepress/component-manifest.ts'

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

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value))
      duplicates.add(value)
    seen.add(value)
  }
  return Array.from(duplicates).sort()
}

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
  const duplicateNames = duplicateValues(documentedComponentNames)
  const duplicateSlugs = duplicateValues(documentedComponents.map(component => component.slug))

  if (duplicateNames.length > 0)
    throw new Error(`duplicate component names in documentation manifest: ${duplicateNames.join(', ')}`)
  if (duplicateSlugs.length > 0)
    throw new Error(`duplicate component slugs in documentation manifest: ${duplicateSlugs.join(', ')}`)

  const documentedNames = new Set(documentedComponentNames)
  const missing = documentedComponentNames.filter(name => !contracts.has(name))
  const undocumented = Array.from(contracts.keys()).filter(name => !documentedNames.has(name)).sort()

  if (missing.length > 0)
    throw new Error(`ai-doc-assistant did not extract: ${missing.join(', ')}`)
  if (undocumented.length > 0)
    throw new Error(`public components missing from documentation manifest: ${undocumented.join(', ')}`)

  const routeDir = resolve(root, 'docs/vitepress/components')
  const expectedRouteFiles = new Set(documentedComponents.map(component => `${component.slug}.md`))
  const actualRouteFiles = readdirSync(routeDir)
    .filter(file => file.endsWith('.md') && file !== 'index.md')
  const missingRoutes = Array.from(expectedRouteFiles).filter(file => !actualRouteFiles.includes(file)).sort()
  const unexpectedRoutes = actualRouteFiles.filter(file => !expectedRouteFiles.has(file)).sort()

  if (missingRoutes.length > 0)
    throw new Error(`documentation routes missing: ${missingRoutes.join(', ')}`)
  if (unexpectedRoutes.length > 0)
    throw new Error(`documentation routes not in manifest: ${unexpectedRoutes.join(', ')}`)

  const invalidBridges: string[] = []
  const missingSourceDocs: string[] = []
  const missingApiDocs: string[] = []
  for (const component of documentedComponents) {
    const routePath = resolve(routeDir, `${component.slug}.md`)
    const expectedInclude = `<!--@include: ../../../packages/components/src/${component.name}/docs/index.md-->`
    if (!readFileSync(routePath, 'utf8').includes(expectedInclude))
      invalidBridges.push(component.slug)

    const sourceDocPath = resolve(root, 'packages/components/src', component.name, 'docs/index.md')
    if (!existsSync(sourceDocPath)) {
      missingSourceDocs.push(component.name)
      continue
    }
    if (!readFileSync(sourceDocPath, 'utf8').includes(`<ApiDocs name="${component.name}" />`))
      missingApiDocs.push(component.name)
  }

  if (invalidBridges.length > 0)
    throw new Error(`documentation route bridges invalid: ${invalidBridges.join(', ')}`)
  if (missingSourceDocs.length > 0)
    throw new Error(`component source documentation missing: ${missingSourceDocs.join(', ')}`)
  if (missingApiDocs.length > 0)
    throw new Error(`component source documentation missing ApiDocs: ${missingApiDocs.join(', ')}`)

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
