import { createDefu } from 'defu'

const mergeDefaults = createDefu((object, key, value) => {
  const target = object as Record<PropertyKey, unknown>
  const defaultValue = target[key]
  if (Array.isArray(value) && Array.isArray(defaultValue)) {
    target[key] = [...new Set([...value, ...defaultValue])]
    return true
  }
})

export function isAddonPayload(option: unknown): option is object | string {
  return (typeof option === 'object' && option !== null && !Array.isArray(option)) || typeof option === 'string'
}

export function isObjectOption(option: unknown): option is object {
  return typeof option === 'object' && option !== null && !Array.isArray(option)
}

export function mergeAddonOptions<TOptions extends object>(
  options: TOptions | undefined,
  defaultOptions: TOptions,
): TOptions {
  return mergeDefaults<TOptions, [TOptions]>((options ?? {}) as TOptions, defaultOptions)
}
