#!/usr/bin/env node

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ServerContext } from '@moluoxixi/ai-doc-assistant'
import { normalizeComponentApiContract } from '@moluoxixi/ai-doc-assistant/api-contract'
import { documentedComponentNames, documentedComponents } from '../.vitepress/component-manifest.ts'
import { docsSite } from '../.vitepress/docs-site.ts'
import { syncApiOutputDirectory } from './api-output.mts'
import { createTypeDetail } from './api-type-detail.mts'
import { createComponentRoutePaths } from './component-routes.mts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '../../..')
const outDir = resolve(scriptDir, '../.vitepress/api')

async function main(): Promise<void> {
  const context = new ServerContext({
    root,
    componentEntries: [docsSite.componentEntry],
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
    const api = normalizeComponentApiContract(contracts.get(name)!, {
      resolveTypeDetail: ({ typeDefs, type, typeRefs }) => createTypeDetail(typeDefs, type, typeRefs),
    })
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
