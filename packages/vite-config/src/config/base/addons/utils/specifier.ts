/** Extract the owning package name from a bare or subpath import specifier. */
export function getPackageName(specifier: string): string {
  const parts = specifier.split('/')
  if (specifier.startsWith('@'))
    return `${parts[0]}/${parts[1]}`

  return parts[0]
}
