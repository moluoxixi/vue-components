import type { MonacoViewerRuntime } from '../types'

export async function loadMonacoViewerRuntime(): Promise<MonacoViewerRuntime> {
  const { createMonacoViewerRuntime } = await import('./monaco-runtime')
  return createMonacoViewerRuntime()
}
