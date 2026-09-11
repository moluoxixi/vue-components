import type { ConfigFormExpressionFunction } from '../types'

function toNumber(value: unknown): number {
  if (value instanceof Date)
    return value.getTime()
  const numeric = Number(value)
  return Number.isNaN(numeric) ? 0 : numeric
}

function toText(value: unknown): string {
  if (value === null || value === undefined)
    return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function flattenNumbers(args: unknown[]): number[] {
  return args.flatMap(argument => Array.isArray(argument) ? flattenNumbers(argument) : [toNumber(argument)])
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '')
    return true
  if (Array.isArray(value))
    return value.length === 0
  if (typeof value === 'object' && !(value instanceof Date))
    return Object.keys(value).length === 0
  return false
}

/**
 * Allow-listed formula library shared by flow conditions and formula fields.
 * Names are matched case-insensitively; every function is a pure computation
 * with loose numeric/text coercion so half-filled forms do not explode.
 */
export const CONFIG_FORM_EXPRESSION_FUNCTIONS: Readonly<Record<string, ConfigFormExpressionFunction>> = {
  ABS: value => Math.abs(toNumber(value)),
  AVG: (...args) => {
    const numbers = flattenNumbers(args)
    return numbers.length === 0 ? 0 : numbers.reduce((sum, item) => sum + item, 0) / numbers.length
  },
  BOOLEAN: value => Boolean(value),
  CEIL: value => Math.ceil(toNumber(value)),
  CONCAT: (...args) => args.map(toText).join(''),
  DATEDIFF: (left, right, unit) => {
    const milliseconds = toNumber(new Date(left as never).getTime()) - toNumber(new Date(right as never).getTime())
    const divisor = unit === 'days' ? 86_400_000 : unit === 'hours' ? 3_600_000 : unit === 'minutes' ? 60_000 : unit === 'seconds' ? 1000 : 1
    return Math.trunc(milliseconds / divisor)
  },
  DEFAULT: (value, fallback) => isEmptyValue(value) ? fallback : value,
  EMPTY: value => isEmptyValue(value),
  ENDSWITH: (value, suffix) => toText(value).endsWith(toText(suffix)),
  FLOOR: value => Math.floor(toNumber(value)),
  IF: (condition, consequent, alternate) => condition ? consequent : alternate,
  INCLUDES: (haystack, needle) => Array.isArray(haystack)
    ? haystack.includes(needle)
    : toText(haystack).includes(toText(needle)),
  JOIN: (items, separator = ',') => (Array.isArray(items) ? items : [items]).map(toText).join(toText(separator)),
  LEN: value => Array.isArray(value) ? value.length : toText(value).length,
  LOWER: value => toText(value).toLowerCase(),
  MAX: (...args) => {
    const numbers = flattenNumbers(args)
    return numbers.length === 0 ? 0 : Math.max(...numbers)
  },
  MIN: (...args) => {
    const numbers = flattenNumbers(args)
    return numbers.length === 0 ? 0 : Math.min(...numbers)
  },
  MOD: (left, right) => toNumber(left) % toNumber(right),
  NOW: () => Date.now(),
  NUMBER: value => toNumber(value),
  POW: (base, exponent) => toNumber(base) ** toNumber(exponent),
  REPLACE: (value, search, replacement) => toText(value).replaceAll(toText(search), toText(replacement)),
  ROUND: (value, digits = 0) => {
    const factor = 10 ** toNumber(digits)
    return Math.round(toNumber(value) * factor) / factor
  },
  SLICE: (value, start, end) => Array.isArray(value)
    ? value.slice(toNumber(start), end === undefined ? undefined : toNumber(end))
    : toText(value).slice(toNumber(start), end === undefined ? undefined : toNumber(end)),
  SPLIT: (value, separator) => toText(value).split(toText(separator)),
  STARTSWITH: (value, prefix) => toText(value).startsWith(toText(prefix)),
  STRING: value => toText(value),
  SUM: (...args) => flattenNumbers(args).reduce((sum, item) => sum + item, 0),
  TODAY: () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  },
  TRIM: value => toText(value).trim(),
  UPPER: value => toText(value).toUpperCase(),
}
