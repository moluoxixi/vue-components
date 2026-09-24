const SETTABLE_ROOTS = new Set([
  'props',
  'field',
  'label',
  'defaultValue',
  'required',
  'requiredMessage',
  'validation',
  'validateOn',
  'span',
])

const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

/** The single write boundary shared by material registration and Inspector commands. */
export function isDesignerSetterPathAllowed(path: readonly string[]): boolean {
  if (path.length === 0 || path.some(segment => !segment || UNSAFE_PATH_SEGMENTS.has(segment)))
    return false
  if (path.includes('optionSource'))
    return false

  const [root] = path
  if (!root || !SETTABLE_ROOTS.has(root))
    return false

  if (root === 'props')
    return path.length >= 2

  return path.length === 1
}

export function assertDesignerSetterPathAllowed(path: readonly string[]): void {
  if (!isDesignerSetterPathAllowed(path)) {
    throw new TypeError(
      `DESIGNER_SETTER_PATH_FORBIDDEN: The default Designer cannot write ${path.join('.') || '<empty>'}.`,
    )
  }
}
