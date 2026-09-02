import type {
  RuntimeNodeFragmentCacheEntry,
  VueRuntimeBindingResolver,
} from '../types'

const runtimeNodeFragmentCaches = new WeakMap<
  VueRuntimeBindingResolver,
  WeakMap<object, RuntimeNodeFragmentCacheEntry>
>()

export function getRuntimeNodeFragmentCache(
  resolver: VueRuntimeBindingResolver,
): WeakMap<object, RuntimeNodeFragmentCacheEntry> {
  const existing = runtimeNodeFragmentCaches.get(resolver)
  if (existing)
    return existing

  const cache = new WeakMap<object, RuntimeNodeFragmentCacheEntry>()
  runtimeNodeFragmentCaches.set(resolver, cache)
  return cache
}
