// @vitest-environment node

import { resolve } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const controls = vi.hoisted(() => ({
  buildIndex: vi.fn<() => Promise<void>>(),
  contextOptions: [] as unknown[],
  createServer: vi.fn(),
  exitCodes: [] as number[],
  listen: vi.fn<() => Promise<void>>(),
  pluginOptions: [] as unknown[],
  snapshot: vi.fn(() => ({ meta: { componentCount: 0 } })),
}))

vi.mock('../src/server/context', () => ({
  ServerContext: class ServerContext {
    readonly state = { snapshot: controls.snapshot }

    constructor(options: unknown) {
      controls.contextOptions.push(options)
    }

    async buildIndex(): Promise<void> {
      await controls.buildIndex()
    }
  },
}))

vi.mock('../src/server/plugin', () => ({
  aiDocAssistant: (options: unknown) => {
    controls.pluginOptions.push(options)
    return { name: 'ai-doc-test-plugin' }
  },
}))

vi.mock('vite', () => ({ createServer: controls.createServer }))

const originalArgv = [...process.argv]

beforeEach(() => {
  vi.resetModules()
  controls.buildIndex.mockResolvedValue()
  controls.contextOptions.length = 0
  controls.createServer.mockReset()
  controls.exitCodes.length = 0
  controls.listen.mockReset().mockResolvedValue()
  controls.pluginOptions.length = 0
  controls.snapshot.mockReturnValue({ meta: { componentCount: 0 } })
  controls.createServer.mockResolvedValue({
    config: { server: {} },
    listen: controls.listen,
  })
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    controls.exitCodes.push(Number(code))
    return undefined as never
  })
})

afterEach(() => {
  process.argv = [...originalArgv]
  vi.restoreAllMocks()
})

async function loadCli(...args: string[]): Promise<{ stderr: string[], stdout: string[] }> {
  const stderr: string[] = []
  const stdout: string[] = []
  process.argv = ['node', 'ai-doc-assistant', ...args]
  vi.spyOn(process.stderr, 'write').mockImplementation((value) => {
    stderr.push(String(value))
    return true
  })
  vi.spyOn(process.stdout, 'write').mockImplementation((value) => {
    stdout.push(String(value))
    return true
  })
  await import('../cli')
  return { stderr, stdout }
}

describe('ai-doc-assistant CLI', () => {
  it('builds the requested entries and globs and reports the contract count', async () => {
    controls.snapshot.mockReturnValue({ meta: { componentCount: 7 } })
    const output = await loadCli(
      'build-index',
      '--root',
      'fixtures/project',
      '--entries',
      'src/a.ts,src/b.ts',
      '--globs',
      'src/**/*.vue,packages/**/*.vue',
    )

    await vi.waitFor(() => expect(controls.buildIndex).toHaveBeenCalledOnce())
    expect(controls.contextOptions).toEqual([{
      root: resolve('fixtures/project'),
      componentEntries: ['src/a.ts', 'src/b.ts'],
      componentGlobs: ['src/**/*.vue', 'packages/**/*.vue'],
    }])
    expect(output.stdout).toEqual(['[ai-doc] contracts extracted: 7 components\n'])
    expect(output.stderr).toEqual([])
    expect(controls.exitCodes).toEqual([])
  })

  it('starts Vite with explicit host and port and reports the resolved port', async () => {
    controls.createServer.mockResolvedValue({
      config: { server: { port: 4310 } },
      listen: controls.listen,
    })
    const output = await loadCli('serve', '--root', '.', '--host', '0.0.0.0', '--port', '4300')

    await vi.waitFor(() => expect(controls.listen).toHaveBeenCalledOnce())
    expect(controls.pluginOptions).toEqual([{ root: resolve('.') }])
    expect(controls.createServer).toHaveBeenCalledWith({
      root: resolve('.'),
      server: { host: '0.0.0.0', port: 4300 },
      plugins: [{ name: 'ai-doc-test-plugin' }],
    })
    expect(output.stdout).toEqual(['[ai-doc] panel ready at http://0.0.0.0:4310/__ai-doc/\n'])
    expect(output.stderr).toEqual([])
    expect(controls.exitCodes).toEqual([])
  })

  it('uses the default server address when Vite does not replace the port', async () => {
    const output = await loadCli('serve')

    await vi.waitFor(() => expect(controls.listen).toHaveBeenCalledOnce())
    expect(controls.createServer).toHaveBeenCalledWith({
      root: process.cwd(),
      server: { host: '127.0.0.1', port: 5173 },
      plugins: [{ name: 'ai-doc-test-plugin' }],
    })
    expect(output.stdout).toEqual(['[ai-doc] panel ready at http://127.0.0.1:5173/__ai-doc/\n'])
  })

  it('prints usage and exits for an unknown command', async () => {
    const output = await loadCli('unknown')

    expect(output.stderr.join('')).toBe(
      'usage:\n'
      + '  ai-doc-assistant build-index [--root <dir>] [--entries <e1,e2>] [--globs <g1,g2>]\n'
      + '  ai-doc-assistant serve [--root <dir>] [--entries <e1,e2>] [--globs <g1,g2>] [--port 5173] [--host 127.0.0.1]\n',
    )
    expect(controls.exitCodes).toEqual([1])
  })

  it('reports invalid ports with a non-zero exit', async () => {
    const invalid = await loadCli('serve', '--port', '70000')
    await vi.waitFor(() => expect(invalid.stderr).toEqual([
      '[ai-doc] error: invalid --port: 70000 (expected integer 1..65535)\n',
    ]))
    expect(controls.createServer).not.toHaveBeenCalled()
    expect(controls.exitCodes).toEqual([1])
  })

  it('reports command failures with a non-zero exit', async () => {
    controls.buildIndex.mockRejectedValue(new Error('extraction failed'))
    const failed = await loadCli('build-index')
    await vi.waitFor(() => expect(failed.stderr).toEqual([
      '[ai-doc] error: extraction failed\n',
    ]))
    expect(controls.exitCodes).toEqual([1])
  })

  it('reports Vite listen failures with a non-zero exit', async () => {
    controls.listen.mockRejectedValue(new Error('address unavailable'))
    const output = await loadCli('serve')

    await vi.waitFor(() => expect(output.stderr).toEqual([
      '[ai-doc] error: address unavailable\n',
    ]))
    expect(controls.exitCodes).toEqual([1])
  })
})
