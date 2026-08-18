#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/component-manifest.ts'
import { componentSourcePath, docsSite } from '../.vitepress/docs-site.ts'
import { createGitLocalMetadata, writeGitLocalMetadata } from './git-local-metadata.mts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDir, '../../..')
const outputPath = resolve(scriptDir, '../.vitepress/git-local-metadata.json')
const shouldStage = process.argv.slice(2).includes('--stage')
const unknownArguments = process.argv.slice(2).filter(argument => argument !== '--stage')

if (unknownArguments.length)
  throw new Error(`Unknown local Git metadata option: ${unknownArguments.join(', ')}`)

const components = documentedComponents.map(component => ({
  name: component.name,
  path: componentSourcePath(component.name),
}))

try {
  const snapshot = createGitLocalMetadata({
    components,
    defaultBranch: docsSite.repository.defaultBranch,
    repositoryRoot,
    repositoryUrl: docsSite.repository.url,
  })

  writeGitLocalMetadata({
    expectation: {
      components,
      defaultBranch: docsSite.repository.defaultBranch,
      repositoryUrl: docsSite.repository.url,
    },
    outputPath,
    snapshot,
  })

  if (shouldStage) {
    const relativeOutputPath = relative(repositoryRoot, outputPath).replaceAll('\\', '/')
    execFileSync('git', ['-C', repositoryRoot, 'add', '--', relativeOutputPath], {
      stdio: 'inherit',
      windowsHide: true,
    })
  }

  console.log(`Synced local Git metadata for ${documentedComponents.length} components at ${snapshot.repository.headSha.slice(0, 7)}${shouldStage ? ' and staged the snapshot' : ''}.`)
}
catch (error) {
  console.error('Local Git metadata sync failed; the previous snapshot was preserved.')
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
}
