// @vitest-environment node

import type { ElementPlusDocsCliRuntime } from '../src/node/lifecycle'
import { describe, expect, it, vi } from 'vitest'
import {
  redactElementPlusDocsCliError,
  runElementPlusDocsCli,
} from '../src/node/lifecycle'

function createRuntime(options: { prepareError?: Error, serveError?: Error } = {}) {
  const events: string[] = []
  const closeHandlers: Array<() => void> = []
  const loaded = {
    docsRoot: 'D:/fixture/docs',
    generatedRoot: 'D:/fixture/docs/.generated',
    project: { repository: { provider: 'local' } },
    projectRoot: 'D:/fixture',
  }
  const server = {
    httpServer: {
      once: vi.fn((_event: string, handler: () => void) => closeHandlers.push(handler)),
    },
    listen: vi.fn(async () => events.push('listen')),
    printUrls: vi.fn(() => events.push('printUrls')),
  }
  const runtime = {
    build: vi.fn(async () => events.push('build')),
    createServer: vi.fn(async () => {
      events.push('createServer')
      return server
    }),
    loadProject: vi.fn(async () => {
      events.push('load')
      return loaded
    }),
    prepare: vi.fn(async () => {
      events.push('prepare')
      if (options.prepareError)
        throw options.prepareError
    }),
    serve: vi.fn(async () => {
      events.push('serve')
      if (options.serveError)
        throw options.serveError
    }),
    watchContent: vi.fn(() => () => events.push('stopWatching')),
  } as unknown as ElementPlusDocsCliRuntime
  return { closeHandlers, events, loaded, runtime, server }
}

describe('element-plus-docs CLI lifecycle', () => {
  it('keeps prepare as a preparation-only command', async () => {
    const { events, runtime } = createRuntime()

    await runElementPlusDocsCli(['prepare'], runtime)

    expect(events).toEqual(['load', 'prepare'])
    expect(runtime.build).not.toHaveBeenCalled()
    expect(runtime.createServer).not.toHaveBeenCalled()
    expect(runtime.serve).not.toHaveBeenCalled()
  })

  it('prepares before building the resolved docs root', async () => {
    const { events, loaded, runtime } = createRuntime()

    await runElementPlusDocsCli(['build'], runtime)

    expect(events).toEqual(['load', 'prepare', 'build'])
    expect(runtime.build).toHaveBeenCalledWith(loaded.docsRoot)
  })

  it('keeps dev server options, content watching, and startup behavior intact', async () => {
    const { closeHandlers, events, loaded, runtime, server } = createRuntime()

    await runElementPlusDocsCli([
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      '4314',
      '--strictPort',
      '--open',
    ], runtime)

    expect(events).toEqual(['load', 'prepare', 'createServer', 'listen', 'printUrls'])
    expect(runtime.createServer).toHaveBeenCalledWith(loaded.docsRoot, {
      host: '127.0.0.1',
      open: true,
      port: 4314,
      strictPort: true,
    })
    expect(runtime.watchContent).toHaveBeenCalledWith(server, {
      docsRoot: loaded.docsRoot,
      generatedRoot: loaded.generatedRoot,
      project: loaded.project,
      projectRoot: loaded.projectRoot,
    })
    expect(closeHandlers).toHaveLength(1)
    closeHandlers[0]!()
    expect(events.at(-1)).toBe('stopWatching')
  })

  it('prepares the project before serving the resolved docs root and requested port', async () => {
    const { events, loaded, runtime } = createRuntime()

    await runElementPlusDocsCli(['preview', '--config', 'fixture.config.ts', '--port', '5322'], runtime)

    expect(events).toEqual(['load', 'prepare', 'serve'])
    expect(runtime.loadProject).toHaveBeenCalledWith({ configPath: 'fixture.config.ts' })
    expect(runtime.prepare).toHaveBeenCalledWith(loaded, { providerOverride: 'local' })
    expect(runtime.serve).toHaveBeenCalledWith({ port: 5322, root: loaded.docsRoot })
  })

  it('does not start the preview server after preparation fails', async () => {
    const failure = new Error('preparation failed')
    const { events, runtime } = createRuntime({ prepareError: failure })

    await expect(runElementPlusDocsCli(['preview'], runtime)).rejects.toBe(failure)

    expect(events).toEqual(['load', 'prepare'])
    expect(runtime.serve).not.toHaveBeenCalled()
  })

  it('propagates preview startup failures without choosing another port', async () => {
    const failure = new Error('listen EADDRINUSE: address already in use 5322')
    const { events, runtime } = createRuntime({ serveError: failure })

    await expect(runElementPlusDocsCli(['preview', '--port', '5322'], runtime)).rejects.toBe(failure)

    expect(events).toEqual(['load', 'prepare', 'serve'])
    expect(runtime.serve).toHaveBeenCalledOnce()
  })

  it('rejects development-server options that VitePress preview does not support', async () => {
    const { runtime } = createRuntime()

    await expect(
      runElementPlusDocsCli(['preview', '--host', '127.0.0.1'], runtime),
    ).rejects.toThrow('preview supports only --config and --port')
    expect(runtime.loadProject).not.toHaveBeenCalled()
  })
})

describe('element-plus-docs CLI error redaction', () => {
  it('redacts plain, URI-encoded, and query-encoded token forms across causes', () => {
    const token = 'secret token/+='
    const uriEncoded = encodeURIComponent(token)
    const queryEncoded = new URLSearchParams({ access_token: token })
      .toString()
      .slice('access_token='.length)
    const cause = new Error(`query=${queryEncoded}`)
    const error = new Error(`plain=${token} uri=${uriEncoded}`, { cause })

    const message = redactElementPlusDocsCliError(error, [token])

    expect(message).not.toContain(token)
    expect(message).not.toContain(uriEncoded)
    expect(message).not.toContain(queryEncoded)
    expect(message.match(/\[REDACTED\]/g)).toHaveLength(3)
    expect(message).toContain('Caused by:')
  })
})
