import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { arch, platform } from 'node:os'
import { basename, resolve } from 'node:path'
import { parseDocument } from 'yaml'

const workspaceRoot = resolve(import.meta.dirname, '..')
const workflowDirectory = resolve(import.meta.dirname, '../.github/workflows')
const workflowFiles = (await readdir(workflowDirectory))
  .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))

const actionlintVersion = '1.7.12'
const actionlintAssets = {
  'darwin-arm64': ['darwin_arm64.tar.gz', 'aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f'],
  'darwin-x64': ['darwin_amd64.tar.gz', '5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644'],
  'linux-arm64': ['linux_arm64.tar.gz', '325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6'],
  'linux-x64': ['linux_amd64.tar.gz', '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8'],
  'win32-x64': ['windows_amd64.zip', '6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9'],
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: workspaceRoot, encoding: 'utf8' })
  if (result.status !== 0) {
    const diagnostics = [result.stdout, result.stderr].filter(Boolean).join('\n')
    throw new Error(`${command} ${args.join(' ')} failed${diagnostics ? `:\n${diagnostics}` : ''}`)
  }
}

async function resolveActionlint() {
  const asset = actionlintAssets[`${platform()}-${arch()}`]
  if (!asset)
    throw new Error(`actionlint ${actionlintVersion} is not configured for ${platform()} ${arch()}`)

  const [assetSuffix, expectedHash] = asset
  const executableName = platform() === 'win32' ? 'actionlint.exe' : 'actionlint'
  const cacheDirectory = resolve(workspaceRoot, 'node_modules/.cache/actionlint', `${actionlintVersion}-${platform()}-${arch()}`)
  const executable = resolve(cacheDirectory, executableName)

  try {
    await chmod(executable, 0o755)
    return executable
  }
  catch {
    await rm(cacheDirectory, { force: true, recursive: true })
  }

  await mkdir(cacheDirectory, { recursive: true })
  const assetName = `actionlint_${actionlintVersion}_${assetSuffix}`
  const downloadUrl = `https://github.com/rhysd/actionlint/releases/download/v${actionlintVersion}/${assetName}`
  const response = await fetch(downloadUrl)
  if (!response.ok)
    throw new Error(`Unable to download actionlint ${actionlintVersion}: ${response.status} ${response.statusText}`)

  const archive = Buffer.from(await response.arrayBuffer())
  const actualHash = createHash('sha256').update(archive).digest('hex')
  if (actualHash !== expectedHash)
    throw new Error(`Checksum mismatch for ${assetName}: expected ${expectedHash}, received ${actualHash}`)

  const archivePath = resolve(cacheDirectory, basename(assetName))
  await writeFile(archivePath, archive)
  try {
    run('tar', ['-xf', archivePath, '-C', cacheDirectory])
  }
  finally {
    await rm(archivePath, { force: true })
  }

  await chmod(executable, 0o755)
  return executable
}

for (const file of workflowFiles) {
  const source = await readFile(resolve(workflowDirectory, file), 'utf8')
  const document = parseDocument(source, { prettyErrors: true, uniqueKeys: true })
  if (document.errors.length > 0) {
    const errors = document.errors.map(error => error.message).join('\n')
    throw new Error(`${file} is invalid:\n${errors}`)
  }

  const workflow = document.toJS()
  if (!workflow?.name || !workflow?.on || !workflow?.jobs)
    throw new Error(`${file} must define name, on, and jobs`)
}

const actionlint = await resolveActionlint()
run(actionlint, workflowFiles.map(file => resolve(workflowDirectory, file)))

console.log(`Validated ${workflowFiles.length} workflow files with actionlint ${actionlintVersion}.`)
