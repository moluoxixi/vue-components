import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import process from 'node:process'
import { parse } from 'yaml'
import {
  createBrowserBuildArgs,
  createBrowserSmokeSource,
  createNodeSmokeSource,
  createPackedConsumerManifest,
  createTypeSmokeSource,
  getBrowserConsumerSpecifiers,
  getPublicSpecifier,
  getTypedJavaScriptEntrypoints,
} from './published-package-verifier.mjs'

const workspaceRoot = resolve(import.meta.dirname, '..')
const rootManifest = JSON.parse(await readFile(resolve(workspaceRoot, 'package.json'), 'utf8'))
const browserMode = process.argv.includes('--browser')
const workspaceManifest = parse(await readFile(resolve(workspaceRoot, 'pnpm-workspace.yaml'), 'utf8'))
const browserBundlerVersion = browserMode ? workspaceManifest.catalogs?.dev?.vite : undefined
if (browserMode && typeof browserBundlerVersion !== 'string')
  throw new Error('pnpm-workspace.yaml must define catalogs.dev.vite for the packed browser consumer.')
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

async function serveDirectory(directory) {
  const resolvedDirectory = resolve(directory)
  const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
  }
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
      const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
      const filePath = resolve(resolvedDirectory, relativePath)
      if (filePath !== resolvedDirectory && !filePath.startsWith(`${resolvedDirectory}${sep}`)) {
        response.writeHead(403).end('Forbidden')
        return
      }
      const contents = await readFile(filePath)
      response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream' })
      response.end(contents)
    }
    catch {
      response.writeHead(404).end('Not found')
    }
  })

  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Unable to determine packed browser consumer server address.')
  }

  return {
    close: () => new Promise((resolveClose, reject) => {
      server.close(error => error ? reject(error) : resolveClose())
    }),
    url: `http://127.0.0.1:${address.port}`,
  }
}

async function verifyBrowserConsumer(consumerDirectory, publishable) {
  const browserDirectory = resolve(consumerDirectory, 'browser')
  const browserSourceDirectory = resolve(browserDirectory, 'src')
  const specifiers = getBrowserConsumerSpecifiers(publishable.map(({ manifest }) => manifest))
  await mkdir(browserSourceDirectory, { recursive: true })
  await writeFile(resolve(browserDirectory, 'index.html'), [
    '<!doctype html>',
    '<html>',
    '<head><meta charset="UTF-8"><title>Packed browser consumer</title></head>',
    '<body><script type="module" src="/src/main.mjs"></script></body>',
    '</html>',
  ].join('\n'))
  await writeFile(
    resolve(browserSourceDirectory, 'main.mjs'),
    createBrowserSmokeSource(specifiers.javaScript, specifiers.stylesheets),
  )
  runPnpm(createBrowserBuildArgs(consumerDirectory, browserDirectory))

  const { chromium } = await import('@playwright/test')
  const staticServer = await serveDirectory(resolve(browserDirectory, 'dist'))
  let browser
  try {
    browser = await chromium.launch()
    const page = await browser.newPage()
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    try {
      await page.goto(staticServer.url)
      try {
        await page.waitForFunction(
          () => window.__PACKED_BROWSER_SMOKE__ !== undefined,
          undefined,
          { timeout: 15_000 },
        )
      }
      catch (error) {
        if (pageErrors.length > 0)
          throw new Error(`Browser errors: ${pageErrors.join('; ')}`, { cause: error })
        throw error
      }
      const result = await page.evaluate(() => window.__PACKED_BROWSER_SMOKE__)
      const failedAssertions = Object.entries(result).filter(([, passed]) => passed !== true).map(([name]) => name)
      if (pageErrors.length > 0 || failedAssertions.length > 0) {
        throw new Error([
          pageErrors.length > 0 ? `Browser errors: ${pageErrors.join('; ')}` : undefined,
          failedAssertions.length > 0 ? `Failed assertions: ${failedAssertions.join(', ')}` : undefined,
        ].filter(Boolean).join('\n'))
      }
    }
    finally {
      await page.close()
    }
  }
  finally {
    await browser?.close()
    await staticServer.close()
  }

  console.log(`Verified ${specifiers.javaScript.length} browser JavaScript entries and ${specifiers.stylesheets.length} stylesheet entries from packed packages.`)
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
  await writeFile(resolve(consumerDirectory, 'package.json'), JSON.stringify(createPackedConsumerManifest({
    browserBundlerVersion,
    packageManager: rootManifest.packageManager,
    packedDependencies,
  })))
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
  await writeFile(resolve(consumerDirectory, 'smoke.mjs'), createNodeSmokeSource(runtimeEntries, consumerEntries))
  await writeFile(resolve(consumerDirectory, 'smoke.mts'), createTypeSmokeSource(consumerEntries))
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

  if (browserMode) {
    await verifyBrowserConsumer(consumerDirectory, publishable)
  }
  else {
    run(process.execPath, [resolve(consumerDirectory, 'smoke.mjs')])
    runPnpm(['--dir', consumerDirectory, 'exec', 'tsc', '-p', resolve(consumerDirectory, 'tsconfig.json')])
    console.log(`Verified ${publishable.length} packed packages and ${consumerEntries.length} public JavaScript entries.`)
  }
}
finally {
  await rm(temporaryRoot, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 })
}
