import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ConfigFormRendererNode } from '../types'
import { isConfigFormField } from '@moluoxixi/config-form-headless'

export function createBem(namespace: () => string) {
  return (element: string, modifier?: string): string => modifier
    ? `${namespace()}__${element}--${modifier}`
    : `${namespace()}__${element}`
}

export function mergeAriaTokens(current: unknown, token: string): string {
  const tokens = typeof current === 'string' ? current.split(/\s+/).filter(Boolean) : []
  return [...new Set([...tokens, token])].join(' ')
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function isVNodeKey(value: unknown): value is string | number | symbol {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'symbol'
}

export function assertAcyclicNode(node: object, ancestors: ReadonlySet<object>): void {
  if (ancestors.has(node))
    throw new Error('ConfigForm node slots must not contain circular references.')
}

export function getNodeKey<TValues extends ConfigFormValues>(
  node: ConfigFormRendererNode<TValues>,
  pathKey: string,
): string | number | symbol {
  const configuredKey = node.props?.key
  if (isVNodeKey(configuredKey))
    return configuredKey
  return isConfigFormField(node) ? `field:${node.field}` : pathKey
}

export function toDomId(path: string): string {
  return path.replace(/[^\w-]+/g, '-')
}
