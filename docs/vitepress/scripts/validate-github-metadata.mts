#!/usr/bin/env node

import { documentedComponents } from '../.vitepress/catalog/component-manifest.ts'
import { readAndValidateRepositoryMetadata } from './repository-metadata-validation.mts'

const metadata = readAndValidateRepositoryMetadata('github')

console.log(`Validated GitHub metadata for ${documentedComponents.length} components at ${metadata.repository.headSha.slice(0, 7)}.`)
