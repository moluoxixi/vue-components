import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Internal path aliases declared by ConfigForm package sources in their
 * tsconfig.app.json `paths`. Packages that inline those sources through the
 * `exports.source` condition (runtime, designer adapters, workbench) need the
 * same mapping to resolve the imports.
 *
 * Keep in sync with packages/ConfigForm/designer/tsconfig.app.json.
 */
const scriptsDirectory = dirname(fileURLToPath(import.meta.url))
const designerSource = resolve(scriptsDirectory, '../packages/ConfigForm/designer/src').replaceAll('\\', '/')

export const configFormInternalAliases = [
  { find: /^@designer\//, replacement: `${designerSource}/` },
]
