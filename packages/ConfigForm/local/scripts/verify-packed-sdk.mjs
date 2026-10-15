import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '../../../..')
const pnpm = process.env.npm_execpath
if (!pnpm)
  throw new Error('Run with pnpm verify:pack.')
const directory = await mkdtemp(join(tmpdir(), 'config-form-packed-sdk-'))
const archives = join(directory, 'archives')
const consumer = join(directory, 'consumer')
await mkdir(archives)
await mkdir(consumer)
async function run(command, args, cwd, capture = false) {
  return await new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', windowsHide: true })
    let output = ''
    if (capture) {
      child.stdout.on('data', chunk => output += chunk)
      child.stderr.on('data', chunk => output += chunk)
    }
    child.once('error', reject)
    child.once('exit', code => code === 0 ? accept(output) : reject(new Error(`${args.join(' ')} failed (${code}): ${output}`)))
  })
}
const dependencies = {}
for (const path of ['packages/zod3-to-rule', ...['core', 'model', 'compiler', 'source', 'studio', 'local'].map(name => `packages/ConfigForm/${name}`)]) {
  const manifest = JSON.parse(await readFile(join(root, path, 'package.json'), 'utf8'))
  await run(process.execPath, [pnpm, 'pack', '--pack-destination', archives], join(root, path), true)
  const filename = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`
  assert((await readdir(archives)).includes(filename))
  dependencies[manifest.name] = `file:${join(archives, filename).replaceAll('\\', '/')}`
}
await writeFile(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { ...dependencies, 'typescript': '5.9.3', '@types/node': '25.6.0', 'vue': '3.5.33', 'zod': '^3.24.2' }, pnpm: { overrides: dependencies } }, null, 2))
await run(process.execPath, [pnpm, 'install', '--ignore-scripts'], consumer)
await writeFile(join(consumer, 'smoke.ts'), `import { createStudioProject, generateProjectSource } from '@moluoxixi/config-form-studio'
import { openHttpProjectRepository } from '@moluoxixi/config-form-studio/client'
import { startLocalWorkspace } from '@moluoxixi/config-form-local'
import { createWorkspaceMcpServer } from '@moluoxixi/config-form-local/mcp'

const document = createStudioProject({ id: 'packed-sdk', name: 'Packed', preset: 'element-plus', templateId: 'element-profile' })
const output = await generateProjectSource({ project: document, preset: 'element-plus' })
if (!output.success) throw new Error(JSON.stringify(output.diagnostics))
const workspace = await startLocalWorkspace({ directory: './workspace', port: 0 })
const repository = await openHttpProjectRepository({ url: workspace.url })
await repository.create({ document, embeddedContents: [] })
if ((await repository.list())[0]?.id !== document.id) throw new Error('Packed repository roundtrip failed')
const mcp = createWorkspaceMcpServer(workspace.url)
await mcp.close()
repository.close()
await workspace.close()
console.log('Packed SDK imports, types, source generation, HTTP and MCP passed')
`)
await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ESNext', lib: ['ESNext', 'DOM'], types: ['node'], module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: false, outDir: './compiled' }, include: ['smoke.ts'] }))
await run(process.execPath, [pnpm, 'exec', 'tsc', '-p', 'tsconfig.json'], consumer)
await run(process.execPath, ['compiled/smoke.js'], consumer)
await run(process.execPath, ['node_modules/@moluoxixi/config-form-local/dist/cli.js', '--help'], consumer)
// Launch the installed CLI and inspect its packaged designer; source aliases are unavailable here.
const child = spawn(process.execPath, ['node_modules/@moluoxixi/config-form-local/dist/cli.js', 'serve', '--workspace', './cli-workspace', '--port', '0'], { cwd: consumer, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
try {
  const url = await new Promise((accept, reject) => {
    const timer = setTimeout(() => reject(new Error('Installed CLI did not start in 20 seconds')), 20_000)
    child.once('error', reject)
    child.once('exit', code => reject(new Error(`Installed CLI exited: ${code}`)))
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
      const match = /ConfigForm: (http:\/\/127\.0\.0\.1:\d+)/.exec(output)
      if (match) {
        clearTimeout(timer)
        accept(match[1])
      }
    })
    child.stderr.on('data', chunk => process.stderr.write(chunk))
  })
  const html = await (await fetch(url)).text()
  assert(html.includes(`name="config-form-workspace" content="${url}"`))
  const frame = await fetch(`${url}/runtime-host.html`)
  assert.equal(frame.status, 200)
}
finally {
  child.kill()
}
process.stdout.write(`Packed CLI and designer passed. Consumer: ${consumer}\n`)
