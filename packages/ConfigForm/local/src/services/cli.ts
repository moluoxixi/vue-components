import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { generateProjectSource } from '@moluoxixi/config-form-studio'
import { startWorkspaceMcp } from './mcp'
import { startLocalWorkspace } from './server'
import { writeSourceDirectory } from './source-files'

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'out': { type: 'string' }, 'workspace': { type: 'string' }, 'port': { type: 'string' }, 'url': { type: 'string' }, 'preset': { type: 'string' }, 'style': { type: 'string' }, 'surface': { type: 'string' }, 'allow-origin': { type: 'string', multiple: true }, 'help': { type: 'boolean', short: 'h' } },
  })
  const [command, file] = positionals
  if (values.help || !command) {
    process.stdout.write('ConfigForm — configuration to editable Vue source\n\nconfig-form generate project.json --out ./app [--preset element-plus|antd-vue] [--style css|tailwind-v4]\nconfig-form serve --workspace ./ui-workspace [--port 4332]\nconfig-form mcp --url http://127.0.0.1:4332\n')
    return
  }
  if (command === 'generate') {
    if (!file || !values.out)
      throw new Error('generate requires a project JSON file and --out directory.')
    const project = JSON.parse(await readFile(file, 'utf8'))
    const preset = values.preset ?? (project.document ?? project).registryLock?.adapter
    if (preset !== 'element-plus' && preset !== 'antd-vue')
      throw new Error('Use --preset element-plus or --preset antd-vue.')
    if (values.style && values.style !== 'css' && values.style !== 'tailwind-v4')
      throw new Error('Use --style css or --style tailwind-v4.')
    const result = await generateProjectSource({ project, preset, styleTarget: values.style as 'css' | 'tailwind-v4' | undefined, surfaceId: values.surface })
    if (!result.success)
      throw new Error(JSON.stringify(result.diagnostics, null, 2))
    const output = await writeSourceDirectory(result.data, values.out)
    process.stdout.write(`Generated ${result.data.files.length} files: ${output}\n`)
    return
  }
  if (command === 'serve') {
    if (!values.workspace)
      throw new Error('serve requires an explicit --workspace directory.')
    const port = values.port === undefined ? 4332 : Number(values.port)
    if (!Number.isInteger(port) || port < 0 || port > 65535)
      throw new Error('Port must be an integer between 0 and 65535.')
    const workspace = await startLocalWorkspace({ directory: values.workspace, port, staticDirectory: fileURLToPath(new URL(/* @vite-ignore */ './designer/', import.meta.url)), allowOrigins: values['allow-origin'] })
    process.stdout.write(`ConfigForm: ${workspace.url}/#/projects\nWorkspace: ${workspace.directory}\nMCP: config-form mcp --url ${workspace.url}\n`)
    let stopping = false
    const stop = async () => {
      if (stopping)
        return
      stopping = true
      await workspace.close()
    }
    process.once('SIGINT', () => {
      void stop()
    })
    process.once('SIGTERM', () => {
      void stop()
    })
    return
  }
  if (command === 'mcp') {
    const url = values.url ?? 'http://127.0.0.1:4332'
    const target = new URL(url)
    if (target.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(target.hostname))
      throw new Error('MCP connects to a local http://127.0.0.1 service.')
    await startWorkspaceMcp(url)
    return
  }
  throw new Error(`Unknown command: ${command}`)
}
main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`)
  process.exitCode = 1
})
