import { spawn } from 'node:child_process'
import process from 'node:process'

if (!process.env.npm_execpath)
  throw new Error('Run with pnpm generate:catalogs.')
const child = spawn(process.execPath, [process.env.npm_execpath, 'exec', 'vitest', 'run', '--config', 'vitest.config.ts', 'src/adapters/__tests__/studio-catalogs.test.ts'], {
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, CONFIG_FORM_UPDATE_CATALOGS: '1' },
})
child.once('error', (error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
child.once('exit', code => process.exitCode = code ?? 1)
