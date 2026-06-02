import type { ChildProcess } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { EventEmitter } from 'node:events'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import {
  createEditorCommand,
  createOpenInEditorMiddleware,
  launchEditor,
  openInEditor,
  parseOpenInEditorPayload,
  resolveAllowedFile,
} from '../src/openInEditor'

/**
 * 创建可控的编辑器进程启动 mock。
 *
 * 通过微任务触发 spawn/error/exit，模拟 child_process 在不同平台上的异步事件顺序。
 */
function createSpawnMock(event: 'error' | 'exit' | 'spawn', result: unknown = new Error('spawn failed')) {
  return vi.fn(() => {
    const child = new EventEmitter() as ChildProcess
    child.unref = vi.fn()

    queueMicrotask(() => {
      if (event === 'error') {
        child.emit('error', result)
      }
      else if (event === 'exit') {
        child.emit('spawn')
        child.emit('exit', typeof result === 'number' ? result : 1)
      }
      else {
        child.emit('spawn')
        child.emit('exit', 0)
      }
    })

    return child
  })
}

/**
 * 创建 middleware 测试用请求流。
 *
 * body 会被一次性推入 Readable，便于覆盖空请求体和非法 JSON。
 */
function createRequest(method: string, body = ''): IncomingMessage {
  const req = new Readable({
    read() {
      this.push(body)
      this.push(null)
    },
  }) as IncomingMessage
  req.method = method
  return req
}

/**
 * 创建可观察的 ServerResponse mock。
 *
 * 记录 statusCode、headers 和 body，避免测试依赖真实 HTTP server。
 */
function createResponse() {
  const response = {
    body: '',
    headers: {} as Record<string, string>,
    statusCode: 0,
    end: vi.fn((body: string) => {
      response.body = body
      return response
    }),
    setHeader: vi.fn((name: string, value: string) => {
      response.headers[name] = value
      return response
    }),
  }
  return response as unknown as ServerResponse & typeof response
}

/**
 * 在指定平台值下执行断言。
 *
 * 同步和异步回调都会恢复 process.platform mock，避免平台分支污染后续用例。
 */
function withPlatform<T>(platform: NodeJS.Platform, callback: () => T): T {
  const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
  const restore = () => platformSpy.mockRestore()

  try {
    const result = callback()
    if (result instanceof Promise)
      return result.finally(restore) as T

    restore()
    return result
  }
  catch (error) {
    restore()
    throw error
  }
}

/**
 * 让动态导入的 openInEditor 模块使用 POSIX 宿主 path 语义。
 *
 * 用于在 Windows 本机复现 Linux CI 对 D:/... 路径的解析差异；测试结束后必须重置模块缓存。
 */
function mockPosixPathHost() {
  vi.doMock('node:path', async () => {
    const actual = await vi.importActual<typeof import('node:path')>('node:path')
    return {
      ...actual,
      basename: actual.posix.basename,
      isAbsolute: actual.posix.isAbsolute,
      relative: actual.posix.relative,
      resolve: actual.posix.resolve,
    }
  })
}

describe('open in editor helpers', () => {
  it('creates non-Windows code-compatible editor commands through launch-editor mappings', () => {
    withPlatform('linux', () => {
      const command = createEditorCommand({
        column: 7,
        editor: 'code',
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        line: 12,
      })

      expect(command).toEqual({
        args: ['-r', '-g', 'D:/project-new/ConfigForm/playgrounds/demo.vue:12:7'],
        command: 'code',
      })
    })
  })

  it('creates Windows preset editor commands through launch-editor mappings', () => {
    withPlatform('win32', () => {
      expect(createEditorCommand({
        column: 7,
        editor: 'code',
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        line: 12,
      })).toEqual({
        args: ['-r', '-g', 'D:/project-new/ConfigForm/playgrounds/demo.vue:12:7'],
        command: 'code',
        shell: true,
      })

      expect(createEditorCommand({
        column: 7,
        editor: 'cursor',
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        line: 12,
      })).toEqual({
        args: ['-r', '-g', 'D:/project-new/ConfigForm/playgrounds/demo.vue:12:7'],
        command: 'cursor',
        shell: true,
      })

      expect(createEditorCommand({
        column: 7,
        editor: 'webstorm',
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        line: 12,
      })).toEqual({
        args: ['--line', '12', '--column', '7', 'D:/project-new/ConfigForm/playgrounds/demo.vue'],
        command: 'webstorm',
        shell: true,
      })

      expect(createEditorCommand({
        column: 7,
        editor: 'D:\\code\\WebStorm 2025.3.2\\bin\\webstorm64.exe',
        file: 'D:\\project-new\\ConfigForm\\playgrounds\\demo.vue',
        line: 12,
      })).toEqual({
        args: ['--line', '12', '--column', '7', 'D:\\project-new\\ConfigForm\\playgrounds\\demo.vue'],
        command: 'D:\\code\\WebStorm 2025.3.2\\bin\\webstorm64.exe',
      })
    })
  })

  it('keeps preset editor commands direct outside Windows', () => {
    withPlatform('linux', () => {
      expect(createEditorCommand({
        column: 7,
        editor: 'cursor',
        file: '/project/ConfigForm/playgrounds/demo.vue',
        line: 12,
      })).toEqual({
        args: ['-r', '-g', '/project/ConfigForm/playgrounds/demo.vue:12:7'],
        command: 'cursor',
      })
    })
  })

  it('rejects invalid open payloads', () => {
    expect(() => parseOpenInEditorPayload({ file: 'demo.vue', line: 0, column: 1 }))
      .toThrow(/line must be a positive integer/)
  })

  it('rejects invalid object shapes', () => {
    expect(() => parseOpenInEditorPayload(null)).toThrow(/payload must be an object/)
    expect(() => parseOpenInEditorPayload({ file: '', line: 1, column: 1 })).toThrow(/file must/)
    expect(() => parseOpenInEditorPayload({ file: 'demo.vue', line: 1, column: 0 })).toThrow(/column must/)
  })

  it('rejects files outside the configured root', () => {
    expect(() => resolveAllowedFile({
      allowRoots: [],
      file: 'D:/project-new/Other/demo.vue',
      root: 'D:/project-new/ConfigForm',
    })).toThrow(/outside the allowed roots/)
  })

  it('allows files inside configured allow roots', () => {
    expect(resolveAllowedFile({
      allowRoots: ['D:/project-new/Other'],
      file: 'D:/project-new/Other/demo.vue',
      root: 'D:/project-new/ConfigForm',
    }).replace(/\\/g, '/')).toBe('D:/project-new/Other/demo.vue')
  })

  it('keeps Windows absolute paths stable when host path semantics are POSIX', async () => {
    vi.resetModules()
    mockPosixPathHost()

    try {
      const { resolveAllowedFile: resolveAllowedFileWithPosixHost } = await import('../src/openInEditor')

      expect(resolveAllowedFileWithPosixHost({
        allowRoots: ['D:/project-new/Other'],
        file: 'D:/project-new/Other/demo.vue',
        root: 'D:/project-new/ConfigForm',
      }).replace(/\\/g, '/')).toBe('D:/project-new/Other/demo.vue')
    }
    finally {
      vi.doUnmock('node:path')
      vi.resetModules()
    }
  })

  it('creates webstorm and custom editor commands', () => {
    withPlatform('linux', () => {
      expect(createEditorCommand({
        column: 7,
        editor: 'sublime',
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        line: 12,
      })).toEqual({
        args: ['D:/project-new/ConfigForm/playgrounds/demo.vue:12:7'],
        command: 'sublime',
      })

      expect(createEditorCommand({
        column: 7,
        editor: 'webstorm',
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        line: 12,
      })).toEqual({
        args: ['--line', '12', '--column', '7', 'D:/project-new/ConfigForm/playgrounds/demo.vue'],
        command: 'webstorm',
      })

      expect(createEditorCommand({
        column: 7,
        editor: { args: ['open'], command: 'custom-editor' },
        file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
        line: 12,
      })).toEqual({ args: ['open'], command: 'custom-editor' })
    })
  })

  it('launches editor commands and reports spawn failures', async () => {
    const spawnSuccess = createSpawnMock('spawn')
    await expect(launchEditor({ args: ['-g', 'demo.vue:1:1'], command: 'code' }, spawnSuccess)).resolves.toBeUndefined()
    expect(spawnSuccess).toHaveBeenCalledWith('code', ['-g', 'demo.vue:1:1'], {
      detached: true,
      stdio: 'ignore',
    })

    await expect(launchEditor(
      { args: ['-g', 'demo.vue:1:1'], command: 'missing-editor' },
      createSpawnMock('error'),
    )).rejects.toThrow(/Failed to start editor command "missing-editor -g demo.vue:1:1": spawn failed/)

    await expect(launchEditor(
      { args: ['-g', 'demo.vue:1:1'], command: 'missing-editor.cmd', shell: true },
      createSpawnMock('exit', 1),
    )).rejects.toThrow(/exited with code 1/)

    await expect(launchEditor(
      { args: ['-g', 'demo.vue:1:1'], command: 'killed-editor.cmd', shell: true },
      vi.fn(() => {
        const child = new EventEmitter() as ChildProcess
        child.unref = vi.fn()
        queueMicrotask(() => child.emit('exit', null, 'SIGTERM'))
        return child
      }),
    )).rejects.toThrow(/exited with signal SIGTERM/)
  })

  it('opens existing files with injected spawn implementation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cf-devtools-'))
    const file = join(root, 'demo.vue')
    writeFileSync(file, '<template />')

    await withPlatform('linux', async () => {
      await expect(openInEditor(
        { column: 1, file, line: 1 },
        { editor: 'code', root, spawn: createSpawnMock('spawn') },
      )).resolves.toBeUndefined()
    })
  })

  it('opens an explicit WebStorm preset on Windows through launch-editor mappings', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cf-devtools-'))
    const file = join(root, 'demo.vue')
    const spawnEditor = createSpawnMock('spawn')
    writeFileSync(file, '<template />')

    await withPlatform('win32', async () => {
      await expect(openInEditor(
        { column: 3, file, line: 2 },
        { editor: 'webstorm', root, spawn: spawnEditor },
      )).resolves.toBeUndefined()

      expect(spawnEditor).toHaveBeenCalledWith('webstorm', ['--line', '2', '--column', '3', file], {
        detached: true,
        shell: true,
        stdio: 'ignore',
      })
    })
  })

  it('opens auto-detected WebStorm on Windows without requiring an editor option', async () => {
    const previousLaunchEditor = process.env.LAUNCH_EDITOR
    const root = mkdtempSync(join(tmpdir(), 'cf-devtools-'))
    const file = join(root, 'demo.vue')
    const webstorm = 'D:\\code\\WebStorm 2025.3.2\\bin\\webstorm64.exe'
    const spawnEditor = createSpawnMock('spawn')
    process.env.LAUNCH_EDITOR = webstorm
    writeFileSync(file, '<template />')

    try {
      await withPlatform('win32', async () => {
        await expect(openInEditor(
          { column: 5, file, line: 4 },
          { root, spawn: spawnEditor },
        )).resolves.toBeUndefined()

        expect(spawnEditor).toHaveBeenCalledWith(webstorm, ['--line', '4', '--column', '5', file], {
          detached: true,
          stdio: 'ignore',
        })
      })
    }
    finally {
      if (previousLaunchEditor === undefined)
        delete process.env.LAUNCH_EDITOR
      else
        process.env.LAUNCH_EDITOR = previousLaunchEditor
    }
  })

  it('rejects missing files during open', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cf-devtools-'))

    await expect(openInEditor(
      { column: 1, file: join(root, 'missing.vue'), line: 1 },
      { editor: 'code', root, spawn: createSpawnMock('spawn') },
    )).rejects.toThrow(/File does not exist/)
  })

  it('handles middleware method, validation, success, and unexpected failures', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cf-devtools-'))
    const file = join(root, 'demo.vue')
    writeFileSync(file, '<template />')

    const methodResponse = createResponse()
    await createOpenInEditorMiddleware({ editor: 'code', root })(createRequest('GET'), methodResponse)
    expect(methodResponse.statusCode).toBe(405)

    const invalidResponse = createResponse()
    await createOpenInEditorMiddleware({ editor: 'code', root })(createRequest('POST', '{"file":""}'), invalidResponse)
    expect(invalidResponse.statusCode).toBe(400)

    const emptyResponse = createResponse()
    await createOpenInEditorMiddleware({ editor: 'code', root })(createRequest('POST'), emptyResponse)
    expect(emptyResponse.statusCode).toBe(400)

    const successResponse = createResponse()
    await createOpenInEditorMiddleware({ editor: 'code', root, spawn: createSpawnMock('spawn') })(
      createRequest('POST', JSON.stringify({ column: 1, file, line: 1 })),
      successResponse,
    )
    expect(successResponse.statusCode).toBe(200)
    expect(successResponse.body).toBe('{"ok":true}')

    const failureResponse = createResponse()
    await createOpenInEditorMiddleware({ editor: 'code', root })(createRequest('POST', '{'), failureResponse)
    expect(failureResponse.statusCode).toBe(500)

    const nonErrorResponse = createResponse()
    await createOpenInEditorMiddleware({ editor: 'code', root, spawn: createSpawnMock('error', 'plain failure') })(
      createRequest('POST', JSON.stringify({ column: 1, file, line: 1 })),
      nonErrorResponse,
    )
    expect(nonErrorResponse.statusCode).toBe(500)
    expect(nonErrorResponse.body).toContain('plain failure')
  })
})
