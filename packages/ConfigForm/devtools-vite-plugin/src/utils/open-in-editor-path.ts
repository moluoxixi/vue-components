import type { ResolveAllowedFileInput } from '../types'
import { isAbsolute, relative, resolve, win32 } from 'node:path'
import { ConfigFormDevtoolsHttpError } from '../errors'

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/')
}

function isWindowsAbsolutePath(input: string): boolean {
  return /^[A-Z]:[\\/]/i.test(input) || /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/.test(input)
}

function resolveAccessPath(input: string, useWindowsPath: boolean): string {
  return useWindowsPath ? win32.resolve(input) : resolve(input)
}

function isInsideRoot(file: string, root: string, useWindowsPath: boolean): boolean {
  const relativePath = useWindowsPath ? win32.relative(root, file) : relative(root, file)
  const relativeIsAbsolute = useWindowsPath ? win32.isAbsolute(relativePath) : isAbsolute(relativePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !relativeIsAbsolute)
}

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
