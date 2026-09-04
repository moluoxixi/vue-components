import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runCli, runCliEntry } from '../cli'

const controls = vi.hoisted(() => ({
  config: {
    configPath: 'D:/workspace/i18n-tool.config.ts',
    root: 'D:/workspace',
    server: { host: '127.0.0.1', open: false, port: 5_174 },
  },
  contextOptions: [] as unknown[],
  createServer: vi.fn(),
  listen: vi.fn(),
  loadConfig: vi.fn(),
  pluginContexts: [] as unknown[],
  printUrls: vi.fn(),
  serverOptions: [] as unknown[],
}))

vi.mock('vite', () => ({
  createServer: controls.createServer,
}))

vi.mock('../src/config', () => ({
  loadI18nToolConfig: controls.loadConfig,
}))

vi.mock('../src/server/context', () => ({
  ServerContext: class ServerContext {
    constructor(options: unknown) {
      controls.contextOptions.push(options)
    }
  },
}))

vi.mock('../src/server/plugin', () => ({
  i18nToolServerPlugin: (context: unknown) => {
    controls.pluginContexts.push(context)
    return { name: 'i18n-tool-test-plugin' }
  },
}))

describe('cLI process contract', () => {
  beforeEach(() => {
    controls.contextOptions.length = 0
    controls.pluginContexts.length = 0
    controls.serverOptions.length = 0
    controls.listen.mockReset().mockResolvedValue(undefined)
    controls.printUrls.mockReset()
    controls.loadConfig.mockReset().mockResolvedValue(controls.config)
    controls.createServer.mockReset().mockImplementation(async (options: unknown) => {
      controls.serverOptions.push(options)
      return { listen: controls.listen, printUrls: controls.printUrls }
    })
    process.exitCode = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.exitCode = undefined
  })

  it('prints help without loading config or starting Vite', async () => {
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => {})

    await runCli(['--help'])

    expect(stdout).toHaveBeenCalledOnce()
    expect(stdout.mock.calls[0][0]).toContain('Usage: i18n-tool [options]')
    expect(controls.loadConfig).not.toHaveBeenCalled()
    expect(controls.createServer).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
  })

  it('starts Vite with resolved config and prints config/root before URLs', async () => {
    const output: string[] = []
    vi.spyOn(console, 'log').mockImplementation(value => output.push(String(value)))
    controls.printUrls.mockImplementation(() => output.push('urls'))

    await runCli(['--config', 'custom.ts', '--root', 'project', '--host', '0.0.0.0', '--port', '6000'])

    expect(controls.loadConfig).toHaveBeenCalledWith({
      cli: {
        configPath: 'custom.ts',
        help: false,
        host: '0.0.0.0',
        port: 6_000,
        root: 'project',
      },
      configPath: 'custom.ts',
    })
    expect(controls.contextOptions).toHaveLength(1)
    expect(controls.createServer).toHaveBeenCalledWith(expect.objectContaining({
      appType: 'spa',
      configFile: false,
      plugins: [{ name: 'i18n-tool-test-plugin' }],
      server: controls.config.server,
    }))
    expect(controls.listen).toHaveBeenCalledOnce()
    expect(output).toEqual([
      '[i18n-tool] config: D:/workspace/i18n-tool.config.ts',
      '[i18n-tool] root: D:/workspace',
      'urls',
    ])
    expect(process.exitCode).toBeUndefined()
  })

  it.each([
    [['--unknown'], 'Unsupported i18n-tool option: --unknown'],
    [['--port', '70000'], '--port must be an integer between 1 and 65535.'],
  ])('prints argument failures to stderr and sets exit code', async (args, message) => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})

    await runCliEntry(args)

    expect(stderr).toHaveBeenCalledWith(`[i18n-tool] ${message}`)
    expect(process.exitCode).toBe(1)
    expect(controls.loadConfig).not.toHaveBeenCalled()
    expect(controls.createServer).not.toHaveBeenCalled()
  })

  it('prints config load failures to stderr and sets exit code', async () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})
    controls.loadConfig.mockRejectedValueOnce(new Error('config not found'))

    await runCliEntry(['--config', 'missing.ts'])

    expect(stderr).toHaveBeenCalledWith('[i18n-tool] config not found')
    expect(process.exitCode).toBe(1)
    expect(controls.createServer).not.toHaveBeenCalled()
  })
})
