import { spawn } from 'node:child_process'
import { cp, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '../../../..')
const pnpm = process.env.npm_execpath
if (!pnpm)
  throw new Error('Run the local package build with pnpm.')
await new Promise((accept, reject) => {
  const child = spawn(process.execPath, [pnpm, '-C', 'packages/ConfigForm/workbench', 'build'], { cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, CONFIG_FORM_WORKBENCH_BASE: '/' } })
  child.once('error', reject)
  child.once('exit', code => code === 0 ? accept() : reject(new Error(`Designer build exited with ${code}`)))
})
const target = resolve(import.meta.dirname, '../dist/designer')
await mkdir(target, { recursive: true })
await cp(resolve(root, 'packages/ConfigForm/workbench/dist'), target, { recursive: true })
