#!/usr/bin/env node

import { documentedComponents } from '../.vitepress/catalog/component-manifest.ts'
import { readAndValidateRepositoryMetadata } from './repository-metadata-validation.mts'

const metadata = readAndValidateRepositoryMetadata('yunxiao')
console.log(`Validated Yunxiao metadata for ${documentedComponents.length} components at ${metadata.repository.headSha.slice(0, 7)}.`)
