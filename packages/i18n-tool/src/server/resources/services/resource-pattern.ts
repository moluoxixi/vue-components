import type { ResolvedI18nToolConfig } from '../../../config'
import { isAbsolute } from 'node:path'
import { I18nToolError } from '../../errors'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replaceAll('\\', '/')
  let expression = '^'
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index]
    if (character === '*' && normalized[index + 1] === '*') {
      const slash = normalized[index + 2] === '/'
      expression += slash ? '(?:.*/)?' : '.*'
      index += slash ? 2 : 1
      continue
    }
    if (character === '*') {
      expression += '[^/]*'
      continue
    }
    if (character === '?') {
      expression += '[^/]'
      continue
    }
    expression += escapeRegExp(character)
  }
  return new RegExp(`${expression}$`)
}

export function staticPatternRoot(pattern: string): string {
  const normalized = pattern.replaceAll('\\', '/')
  const dynamicIndex = normalized.search(/[*?{]/)
  const staticPart = dynamicIndex < 0 ? normalized : normalized.slice(0, dynamicIndex)
  const segments = staticPart.split('/').filter(Boolean)
  if (dynamicIndex < 0 && segments.length > 0)
    segments.pop()
  return segments.join('/') || '.'
}

function templateRegExp(pattern: string): RegExp {
  const normalized = pattern.replaceAll('\\', '/')
  let expression = '^'
  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized.startsWith('{locale}', index)) {
      expression += '(?<locale>[^/]+)'
      index += '{locale}'.length - 1
      continue
    }
    if (normalized.startsWith('{namespace}', index)) {
      expression += '(?<namespace>[^/]+)'
      index += '{namespace}'.length - 1
      continue
    }
    expression += escapeRegExp(normalized[index])
  }
  return new RegExp(`${expression}$`)
}

export function parseResourceIdentity(
  relativePath: string,
  config: ResolvedI18nToolConfig['resources'],
): { locale?: string, namespace?: string } {
  if (config.layout === 'locale-first')
    return { namespace: config.namespace }
  const match = templateRegExp(config.localePattern).exec(relativePath.replaceAll('\\', '/'))
  if (!match?.groups?.locale) {
    throw new I18nToolError(
      'INVALID_CONFIG',
      `Resource path does not match localePattern: ${relativePath}`,
      400,
    )
  }
  return {
    locale: match.groups.locale,
    namespace: match.groups.namespace ?? config.namespace,
  }
}

export function targetRelativePath(
  config: ResolvedI18nToolConfig['resources'],
  targetLocale: string,
  namespace?: string,
): string {
  const value = config.localePattern
    .replaceAll('{locale}', targetLocale)
    .replaceAll('{namespace}', namespace ?? config.namespace ?? '')
  const normalized = value.replaceAll('\\', '/')
  if (
    value.includes('{')
    || isAbsolute(value)
    || normalized.split('/').some(segment => segment === '..' || segment === '')
  ) {
    throw new I18nToolError('INVALID_CONFIG', 'Unable to resolve the target locale path pattern.', 400)
  }
  return normalized
}
