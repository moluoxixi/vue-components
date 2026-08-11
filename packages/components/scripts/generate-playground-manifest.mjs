import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildSync } from 'esbuild'

const packageRoot = resolve(import.meta.dirname, '..')
const repositoryRoot = resolve(packageRoot, '../..')
const packagesRoot = resolve(repositoryRoot, 'packages')
const distRoot = resolve(packageRoot, 'dist')

function packageNameFromSpecifier(specifier) {
  const segments = specifier.split('/')
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]
}

async function collectWorkspaceManifests(directory, manifests = new Map()) {
  const entries = await readdir(directory, { withFileTypes: true })
  const packageJsonEntry = entries.find(entry => entry.isFile() && entry.name === 'package.json')

  if (packageJsonEntry) {
    const manifest = JSON.parse(await readFile(resolve(directory, packageJsonEntry.name), 'utf8'))
    if (typeof manifest.name === 'string')
      manifests.set(manifest.name, manifest)
    return manifests
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'dist' || entry.name === 'node_modules')
      continue
    await collectWorkspaceManifests(resolve(directory, entry.name), manifests)
  }

  return manifests
}

function collectEntryExternalPackages(entryFile) {
  const result = buildSync({
    bundle: true,
    entryPoints: [entryFile],
    format: 'esm',
    logLevel: 'silent',
    metafile: true,
    packages: 'external',
    platform: 'browser',
    write: false,
  })
  const externalPackages = new Set()

  for (const output of Object.values(result.metafile.outputs)) {
    for (const imported of output.imports) {
      if (imported.external)
        externalPackages.add(packageNameFromSpecifier(imported.path))
    }
  }

  return externalPackages
}

function addDependency(dependencies, name, range) {
  const existingRange = dependencies[name]
  if (existingRange && existingRange !== range) {
    throw new Error(`Conflicting playground dependency ranges for ${name}: ${existingRange} and ${range}`)
  }
  dependencies[name] = range
}

function collectWorkspacePeerDependencies(packageName, workspaceManifests, dependencies, visited = new Set()) {
  if (visited.has(packageName))
    return
  visited.add(packageName)

  const manifest = workspaceManifests.get(packageName)
  if (!manifest)
    throw new Error(`Missing workspace manifest for ${packageName}`)

  for (const [peerName, range] of Object.entries(manifest.peerDependencies ?? {})) {
    if (workspaceManifests.has(peerName))
      collectWorkspacePeerDependencies(peerName, workspaceManifests, dependencies, visited)
    else
      addDependency(dependencies, peerName, range)
  }

  for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
    if (workspaceManifests.has(dependencyName))
      collectWorkspacePeerDependencies(dependencyName, workspaceManifests, dependencies, visited)
  }
}

async function createEntryManifest(specifier, symbols, packageManifest, workspaceManifests) {
  const entryName = specifier.slice(packageManifest.name.length + 1)
  const externalPackages = collectEntryExternalPackages(resolve(distRoot, `${entryName}.js`))
  const dependencies = { [packageManifest.name]: 'latest' }

  for (const externalPackage of externalPackages) {
    const peerRange = packageManifest.peerDependencies?.[externalPackage]
    if (peerRange) {
      addDependency(dependencies, externalPackage, peerRange)
      continue
    }

    if (workspaceManifests.has(externalPackage)) {
      collectWorkspacePeerDependencies(externalPackage, workspaceManifests, dependencies)
      continue
    }

    if (!packageManifest.dependencies?.[externalPackage])
      throw new Error(`${specifier} imports undeclared external package ${externalPackage}`)
  }

  const sortedDependencies = Object.fromEntries(
    Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right)),
  )
  const styleImports = [
    `${packageManifest.name}/styles`,
    ...('element-plus' in sortedDependencies ? ['element-plus/dist/index.css'] : []),
  ]

  return {
    dependencies: sortedDependencies,
    exports: [...symbols].sort(),
    styleImports,
  }
}

async function generatePlaygroundManifest() {
  const packageManifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))
  const workspaceManifests = await collectWorkspaceManifests(packagesRoot)
  const { autoImport } = await import(`${pathToFileURL(resolve(distRoot, 'auto-loaders.js')).href}?generated=${Date.now()}`)
  const symbolsBySpecifier = new Map()

  for (const subpath of Object.keys(packageManifest.exports).filter(path => /^\.\/[A-Z]/.test(path))) {
    const name = subpath.slice(2)
    symbolsBySpecifier.set(`${packageManifest.name}/${name}`, new Set([name]))
  }

  for (const [specifier, symbols] of Object.entries(autoImport)) {
    const currentSymbols = symbolsBySpecifier.get(specifier) ?? new Set()
    for (const symbol of symbols)
      currentSymbols.add(symbol)
    symbolsBySpecifier.set(specifier, currentSymbols)
  }

  const imports = {}
  for (const [specifier, symbols] of [...symbolsBySpecifier].sort(([left], [right]) => left.localeCompare(right))) {
    imports[specifier] = await createEntryManifest(
      specifier,
      symbols,
      packageManifest,
      workspaceManifests,
    )
  }

  const manifest = {
    imports,
    packageName: packageManifest.name,
  }
  const serializedManifest = JSON.stringify(manifest, null, 2)
  const jsSource = `const manifest = ${serializedManifest}\n\nexport default manifest\n`
  const declarationSource = `declare const manifest: {
  readonly packageName: string
  readonly imports: Readonly<Record<string, {
    readonly dependencies: Readonly<Record<string, string>>
    readonly exports: readonly string[]
    readonly styleImports: readonly string[]
  }>>
}

export default manifest
`

  await Promise.all([
    writeFile(resolve(distRoot, 'playground-manifest.js'), jsSource, 'utf8'),
    writeFile(resolve(distRoot, 'playground-manifest.d.ts'), declarationSource, 'utf8'),
  ])
  console.log(`Generated playground metadata for ${Object.keys(imports).length} component entries.`)
}

await generatePlaygroundManifest()
