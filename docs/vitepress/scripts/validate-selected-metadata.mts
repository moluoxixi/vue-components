#!/usr/bin/env node

import { repositoryMetadataSelection } from '../.vitepress/repository/selection.ts'
import { readAndValidateRepositoryMetadata } from './repository-metadata-validation.mts'

const metadata = readAndValidateRepositoryMetadata(repositoryMetadataSelection.providerId)

console.log(`Validated selected ${metadata.provider.id} metadata at ${metadata.repository.headSha.slice(0, 7)}.`)
