import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  EditorCommand,
  EditorCommandInput,
  OpenInEditorOptions,
  OpenInEditorPayload,
  SpawnEditorProcess,
} from './types'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, isAbsolute, relative, resolve, win32 } from 'node:path'
import process from 'node:process'
import { ConfigFormDevtoolsHttpError } from './types'

type LaunchEditorArgumentResolver = (
  editor: string,
  fileName: string,
  lineNumber: string,
  columnNumber: string,
) => string[]

type LaunchEditorCommandResolver = (specifiedEditor?: string) => [string | null, ...string[]]

interface ResolveAllowedFileInput {
  file: string
  root: string
  allowRoots?: string[]
}

const require = createRequire(import.meta.url)
const getArgumentsForPosition = require('launch-editor/get-args') as LaunchEditorArgumentResolver
const guessEditorCommand = require('launch-editor/guess') as LaunchEditorCommandResolver

/** 将文件路径规范化为前端可展示的 POSIX 形式。 */
function normalizePath(input: string): string {
  return input.replace(/\\/g, '/')
}

/** 判断路径字符串是否是 Windows 盘符或 UNC 绝对路径。 */
function isWindowsAbsolutePath(input: string): boolean {
  return /^[A-Z]:[\\/]/i.test(input) || /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/.test(input)
}

/**
 * 解析用于访问控制比较的路径。
 *
 * 当浏览器传入 Windows 绝对路径而服务进程运行在 POSIX 宿主时，必须使用 win32 语义，
 * 避免 D:/... 被当前工作目录前缀错误拼接。
 */
function resolveAccessPath(input: string, useWindowsPath: boolean): string {
  return useWindowsPath ? win32.resolve(input) : resolve(input)
}

/**
 * 判断文件是否位于允许根目录内。
 *
 * 使用 path.relative 判断边界，避免简单前缀匹配误放行相邻目录。
 */
function isInsideRoot(file: string, root: string, useWindowsPath: boolean): boolean {
  const relativePath = useWindowsPath ? win32.relative(root, file) : relative(root, file)
  const relativeIsAbsolute = useWindowsPath ? win32.isAbsolute(relativePath) : isAbsolute(relativePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !relativeIsAbsolute)
}

/** 判断用户传入的编辑器字符串是否已经是具体 launcher 路径或文件名。 */
function isEditorLauncher(editor: string): boolean {
  return editor.includes('\\')
    || editor.includes('/')
    || /\.(?:exe|cmd|bat)$/i.test(basename(editor))
}

/**
 * 解析编辑器命令名和 shell 策略。
 *
 * 未显式传入编辑器时交给 launch-editor 根据运行进程和环境变量推导。
 */
function resolveEditorExecutable(editor?: string): Pick<EditorCommand, 'args' | 'command' | 'shell'> {
  const [command, ...args] = editor && isEditorLauncher(editor)
    ? [editor]
    : guessEditorCommand(editor)

  if (!command) {
    throw new ConfigFormDevtoolsHttpError(
      500,
      'Unable to resolve editor command. Configure configFormDevtools({ editor: "code" | "cursor" | "webstorm" }) or set LAUNCH_EDITOR.',
    )
  }

  return {
    args,
    command,
    ...(shouldUseShell(command) ? { shell: true } : {}),
  }
}

/** 格式化编辑器命令用于错误信息展示，不参与实际 shell 拼接。 */
function formatEditorCommand(command: EditorCommand): string {
  return [command.command, ...command.args].join(' ')
}

/**
 * 判断编辑器命令是否必须通过 shell 解析。
 *
 * Windows 下 code/cursor 这类 PATH 命令通常由 .cmd 包装器提供，必须走 shell；
 * 已解析到 .exe 的完整路径则直接 spawn，避免带空格路径被 shell 重新拆分。
 */
function shouldUseShell(command: string): boolean {
  if (process.platform !== 'win32')
    return false

  return !basename(command).toLowerCase().endsWith('.exe')
}

/**
 * 生成传给 launch-editor 参数映射的编辑器名称。
 *
 * launch-editor/get-args 内部使用宿主 path.basename；这里先用 win32.basename 归一化，
 * 确保 Linux CI 也能识别 D:\...\webstorm64.exe 这类 Windows 可执行路径。
 */
function getEditorArgumentResolverName(command: string): string {
  return win32.basename(command).replace(/\.(?:exe|cmd|bat)$/i, '')
}

/** 校验并规范化浏览器 devtools client 发送的 JSON payload。 */
export function parseOpenInEditorPayload(input: unknown): OpenInEditorPayload {
  if (!input || typeof input !== 'object')
    throw new ConfigFormDevtoolsHttpError(400, 'Open-in-editor payload must be an object')

  const payload = input as Partial<OpenInEditorPayload>
  if (typeof payload.file !== 'string' || payload.file.length === 0)
    throw new ConfigFormDevtoolsHttpError(400, 'file must be a non-empty string')
  if (!Number.isInteger(payload.line) || Number(payload.line) <= 0)
    throw new ConfigFormDevtoolsHttpError(400, 'line must be a positive integer')
  if (!Number.isInteger(payload.column) || Number(payload.column) <= 0)
    throw new ConfigFormDevtoolsHttpError(400, 'column must be a positive integer')

  const line = Number(payload.line)
  const column = Number(payload.column)

  return {
    column,
    file: payload.file,
    line,
  }
}

/** 解析请求文件，并拒绝配置根目录之外的路径。 */
export function resolveAllowedFile(input: ResolveAllowedFileInput): string {
  const rawRoots = [input.root, ...(input.allowRoots ?? [])]
  const useWindowsPath = [input.file, ...rawRoots].some(isWindowsAbsolutePath)
  const file = resolveAccessPath(input.file, useWindowsPath)
  const roots = rawRoots.map(root => resolveAccessPath(root, useWindowsPath))

  if (!roots.some(root => isInsideRoot(file, root, useWindowsPath))) {
    throw new ConfigFormDevtoolsHttpError(
      403,
      `File is outside the allowed roots: ${normalizePath(file)}`,
    )
  }

  return file
}

/** 根据源码位置和编辑器预设构造启动命令。 */
export function createEditorCommand(input: EditorCommandInput): EditorCommand {
  if (input.editor && typeof input.editor === 'object')
    return input.editor

  const executable = resolveEditorExecutable(input.editor)
  const locationArgs = getArgumentsForPosition(
    getEditorArgumentResolverName(executable.command),
    input.file,
    String(input.line),
    String(input.column),
  )

  return {
    ...executable,
    args: [...executable.args, ...locationArgs],
  }
}

/** 启动编辑器命令；进程无法启动或 shell 命令失败时返回失败。 */
export function launchEditor(
  command: EditorCommand,
  spawnEditor: SpawnEditorProcess = spawn,
): Promise<void> {
  return new Promise((resolveLaunch, rejectLaunch) => {
    let settled = false
    const child = spawnEditor(command.command, command.args, {
      detached: true,
      ...(command.shell ? { shell: true } : {}),
      stdio: 'ignore',
    })

    /**
     * 结束一次编辑器启动 Promise。
     *
     * 只允许结算一次，避免 error/exit/spawn 多事件竞态导致重复回调。
     */
    function settle(error?: Error) {
      if (settled)
        return

      settled = true
      if (error) {
        rejectLaunch(error)
        return
      }

      child.unref()
      resolveLaunch()
    }

    child.once('error', (error) => {
      const message = error instanceof Error ? error.message : String(error)
      settle(new Error(`Failed to start editor command "${formatEditorCommand(command)}": ${message}`))
    })

    if (command.shell) {
      child.once('exit', (code, signal) => {
        if (typeof code === 'number' && code !== 0) {
          settle(new Error(`Editor command "${formatEditorCommand(command)}" exited with code ${code}`))
          return
        }

        if (signal) {
          settle(new Error(`Editor command "${formatEditorCommand(command)}" exited with signal ${signal}`))
          return
        }

        settle()
      })
      return
    }

    child.once('spawn', () => {
      settle()
    })
  })
}

/** 在配置的编辑器中打开已经校验过的源码位置。 */
export async function openInEditor(payload: unknown, options: OpenInEditorOptions): Promise<void> {
  const parsed = parseOpenInEditorPayload(payload)
  const file = resolveAllowedFile({
    allowRoots: options.allowRoots,
    file: parsed.file,
    root: options.root,
  })

  if (!existsSync(file))
    throw new ConfigFormDevtoolsHttpError(404, `File does not exist: ${file}`)

  const command = createEditorCommand({
    ...parsed,
    editor: options.editor,
    file,
  })
  await launchEditor(command, options.spawn)
}

/**
 * 读取 open-in-editor HTTP 请求体。
 *
 * 流错误会拒绝 Promise，由 middleware 统一转成显式 JSON 错误响应。
 */
function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))))
    req.on('error', rejectBody)
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
  })
}

/**
 * 发送 JSON 响应。
 *
 * payload 必须是可序列化对象；该函数不吞掉 JSON.stringify 抛错。
 */
function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

/** 创建支撑 /__config-form-devtools/open 的 Vite middleware。 */
export function createOpenInEditorMiddleware(options: OpenInEditorOptions) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    try {
      const rawBody = await readRequestBody(req)
      const payload = rawBody ? JSON.parse(rawBody) : {}
      await openInEditor(payload, options)
      sendJson(res, 200, { ok: true })
    }
    catch (error) {
      if (error instanceof ConfigFormDevtoolsHttpError) {
        sendJson(res, error.statusCode, { error: error.message })
        return
      }

      const message = error instanceof Error ? error.message : String(error)
      sendJson(res, 500, { error: message })
    }
  }
}
