import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'

const workspaceRoot = resolve(import.meta.dirname, '..')
const rootManifest = JSON.parse(await readFile(resolve(workspaceRoot, 'package.json'), 'utf8'))
const bundledPnpmCli = resolve(dirname(process.execPath), 'node_modules/pnpm/bin/pnpm.mjs')
const pnpmCli = process.env.npm_execpath || (existsSync(bundledPnpmCli) ? bundledPnpmCli : undefined)
const pnpmCommand = pnpmCli ? process.execPath : 'pnpm'
const pnpmPrefix = pnpmCli ? [pnpmCli] : []

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? 'pipe' : 'inherit',
    ...options,
  })
  if (result.status !== 0) {
    const diagnostics = [result.error?.message, result.signal, result.stdout, result.stderr].filter(Boolean).join('\n')
    throw new Error(`${command} ${args.join(' ')} failed${diagnostics ? `:\n${diagnostics}` : ''}`)
  }
  return result.stdout ?? ''
}

function runPnpm(args, options) {
  return run(pnpmCommand, [...pnpmPrefix, ...args], options)
}

function importName(name) {
  return name.replace(/[^\w$]/g, '_')
}

function getTypedJavaScriptEntrypoints(manifest) {
  return Object.entries(manifest.exports ?? {})
    .filter(([, conditions]) => (
      conditions
      && typeof conditions === 'object'
      && typeof conditions.types === 'string'
      && typeof conditions.import === 'string'
    ))
    .map(([subpath]) => subpath)
}

function getPublicSpecifier(packageName, subpath) {
  return subpath === '.' ? packageName : `${packageName}/${subpath.slice(2)}`
}

const workspace = JSON.parse(runPnpm(['list', '-r', '--depth', '-1', '--json'], { capture: true }))
const packages = workspace.filter(pkg => pkg.path !== workspaceRoot && pkg.name)
const publishable = []

for (const pkg of packages) {
  const manifest = JSON.parse(await readFile(resolve(pkg.path, 'package.json'), 'utf8'))
  if (manifest.private === true || !manifest.version)
    continue
  publishable.push({ manifest, path: pkg.path })
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'moluoxixi-packages-'))
const packDirectory = resolve(temporaryRoot, 'packs')
const consumerDirectory = resolve(temporaryRoot, 'consumer')

try {
  await mkdir(packDirectory, { recursive: true })
  const packedPackages = []
  for (const pkg of publishable) {
    const output = runPnpm([
      '--config.ignore-scripts=true',
      '--dir',
      pkg.path,
      'pack',
      '--pack-destination',
      packDirectory,
      '--json',
    ], { capture: true })
    const packed = JSON.parse(output)
    const filename = Array.isArray(packed) ? packed[0]?.filename : packed.filename
    if (!filename)
      throw new Error(`pnpm pack did not report a tarball for ${pkg.manifest.name}`)
    const tarball = resolve(packDirectory, basename(filename))
    packedPackages.push({ name: pkg.manifest.name, tarball })
    runPnpm(['exec', 'publint', tarball, '--strict'], { capture: true })
    const entrypoints = getTypedJavaScriptEntrypoints(pkg.manifest)
    runPnpm([
      'exec',
      'attw',
      tarball,
      '--profile',
      'esm-only',
      '--no-emoji',
      ...(entrypoints.length > 0 ? ['--entrypoints', ...entrypoints] : []),
    ], { capture: true })
    console.log(`Verified packed exports for ${pkg.manifest.name}.`)
  }

  await mkdir(consumerDirectory, { recursive: true })
  const packedDependencies = Object.fromEntries(packedPackages.map(({ name, tarball }) => [
    name,
    `file:${tarball.replaceAll('\\', '/')}`,
  ]))
  await writeFile(resolve(consumerDirectory, 'package.json'), JSON.stringify({
    dependencies: packedDependencies,
    packageManager: rootManifest.packageManager,
    private: true,
    type: 'module',
  }))
  await writeFile(resolve(consumerDirectory, 'pnpm-workspace.yaml'), JSON.stringify({
    overrides: packedDependencies,
  }))
  runPnpm([
    '--dir',
    consumerDirectory,
    'install',
    '--ignore-scripts',
    '--no-lockfile',
    '--trust-policy-ignore-after',
    '10080',
  ])

  const consumerEntries = publishable.flatMap(({ manifest }) => (
    getTypedJavaScriptEntrypoints(manifest)
      .filter(subpath => !subpath.includes('*'))
      .map(subpath => getPublicSpecifier(manifest.name, subpath))
  ))
  const runtimeEntries = publishable.map(({ manifest }) => manifest.name)
  const runtimeImports = runtimeEntries.map((specifier, index) => (
    `import * as ${importName(`${specifier}_${index}`)} from ${JSON.stringify(specifier)};`
  ))
  const runtimeAssertions = runtimeEntries.map((specifier, index) => (
    `if (!${importName(`${specifier}_${index}`)}) throw new Error(${JSON.stringify(`Unable to import ${specifier}`)});`
  ))
  const resolutionAssertions = consumerEntries.map(specifier => (
    `if (!import.meta.resolve(${JSON.stringify(specifier)})) throw new Error(${JSON.stringify(`Unable to resolve ${specifier}`)});`
  ))
  const typeImports = consumerEntries.map(specifier => `import ${JSON.stringify(specifier)};`)
  await writeFile(resolve(consumerDirectory, 'smoke.mjs'), [
    ...runtimeImports,
    ...runtimeAssertions,
    ...resolutionAssertions,
  ].join('\n'))
  await writeFile(resolve(consumerDirectory, 'smoke.mts'), typeImports.join('\n'))
  await writeFile(resolve(consumerDirectory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noEmit: true,
      skipLibCheck: true,
      target: 'ESNext',
    },
    files: ['smoke.mts'],
  }))

  run(process.execPath, [resolve(consumerDirectory, 'smoke.mjs')])
  runPnpm(['--dir', consumerDirectory, 'exec', 'tsc', '-p', resolve(consumerDirectory, 'tsconfig.json')])
  console.log(`Verified ${publishable.length} packed packages and ${consumerEntries.length} public JavaScript entries.`)
}
finally {
  await rm(temporaryRoot, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 })
}
