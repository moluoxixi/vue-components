import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { loadPackageArchitectureManifest } from './config/index.mjs'
import {
  collectPackageArchitectureDiagnostics,
  collectPackageInventory,
  reconcilePackageArchitectureDiagnostics,
} from './services/index.mjs'

export function auditPackageArchitecture(repositoryRoot) {
  const packages = collectPackageInventory(repositoryRoot)
  return {
    diagnostics: collectPackageArchitectureDiagnostics(repositoryRoot, packages),
    packages,
  }
}

export function verifyPackageArchitecture(repositoryRoot, manifestPath) {
  const audit = auditPackageArchitecture(repositoryRoot)
  const manifest = loadPackageArchitectureManifest(repositoryRoot, manifestPath)
  return {
    ...audit,
    manifest,
    reconciliation: reconcilePackageArchitectureDiagnostics(audit.diagnostics, manifest),
  }
}

function printDiagnostics(title, diagnostics) {
  if (diagnostics.length === 0)
    return
  console.error(`${title} (${diagnostics.length})`)
  for (const diagnostic of diagnostics) {
    const owners = diagnostic.owners?.length ? ` owners=${diagnostic.owners.join(',')}` : ''
    console.error(`- [${diagnostic.rule}] ${diagnostic.path}${owners}`)
    console.error(`  ${diagnostic.message ?? diagnostic.reason}`)
  }
}

export function runPackageArchitectureCli(repositoryRoot, args = process.argv.slice(2)) {
  const unsupportedArgs = args.filter(argument => !['--audit', '--json'].includes(argument))
  if (unsupportedArgs.length > 0) {
    console.error(`Unsupported package architecture arguments: ${unsupportedArgs.join(', ')}`)
    return 1
  }
  const auditOnly = args.includes('--audit')
  const json = args.includes('--json')
  if (auditOnly) {
    const result = auditPackageArchitecture(repositoryRoot)
    console.log(json ? JSON.stringify(result.diagnostics, null, 2) : `AUDIT ${result.packages.length} packages, ${result.diagnostics.length} diagnostics`)
    if (!json) {
      printDiagnostics('Diagnostics', result.diagnostics)
    }
    return 0
  }

  const result = verifyPackageArchitecture(repositoryRoot)
  const { staleDebt, staleExceptions, unknown } = result.reconciliation
  if (json) {
    console.log(JSON.stringify({ packageCount: result.packages.length, staleDebt, staleExceptions, unknown }, null, 2))
  }
  else if (staleDebt.length === 0 && staleExceptions.length === 0 && unknown.length === 0) {
    console.log(`PASS package architecture (${result.packages.length} packages, ${result.manifest.debt.length} tracked debt)`)
  }
  else {
    printDiagnostics('Unknown architecture violations', unknown)
    printDiagnostics('Stale architecture debt', staleDebt)
    printDiagnostics('Stale architecture exceptions', staleExceptions)
  }
  return staleDebt.length === 0 && staleExceptions.length === 0 && unknown.length === 0 ? 0 : 1
}

const repositoryRoot = resolve(import.meta.dirname, '../..')
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runPackageArchitectureCli(repositoryRoot)
}
