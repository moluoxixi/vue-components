import { toRaw } from 'vue'

/** Clone JSON-like workbench state without leaking Vue reactive proxies. */
export function cloneWorkbenchJson<T>(value: T): T {
  const raw = toRaw(value)
  try {
    if (typeof structuredClone === 'function')
      return structuredClone(raw)
  }
  catch {
    // Reactive proxies and host objects are not always structured-cloneable;
    // the model/value boundary is JSON-only, so use a deterministic fallback.
  }
  return JSON.parse(JSON.stringify(raw)) as T
}
