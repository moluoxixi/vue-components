const REDACTED = '[REDACTED]'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function percentInsensitivePattern(value: string): RegExp {
  let pattern = ''
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    const hex = value.slice(index + 1, index + 3)
    if (character === '%' && /^[\dA-F]{2}$/i.test(hex)) {
      pattern += `%${[...hex].map(part => /[A-F]/i.test(part)
        ? `[${part.toLowerCase()}${part.toUpperCase()}]`
        : part).join('')}`
      index += 2
      continue
    }
    pattern += escapeRegExp(character)
  }
  return new RegExp(pattern, 'g')
}

/** Redact raw and encoded secret forms without exposing them to callers. */
export function redactSensitiveText(value: string, secrets: readonly string[]): string {
  let redacted = value
  const rawSecrets = [...new Set(secrets.filter(Boolean))]
    .sort((left, right) => right.length - left.length)
  for (const secret of rawSecrets)
    redacted = redacted.split(secret).join(REDACTED)

  const encodedSecrets = [...new Set(rawSecrets.flatMap(secret => [
    encodeURIComponent(secret),
    new URLSearchParams({ value: secret }).toString().slice('value='.length),
  ]).filter(encoded => !rawSecrets.includes(encoded)))]
    .sort((left, right) => right.length - left.length)
  for (const encoded of encodedSecrets)
    redacted = redacted.replace(percentInsensitivePattern(encoded), REDACTED)
  return redacted
}
