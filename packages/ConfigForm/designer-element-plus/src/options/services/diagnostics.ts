import type {
  DesignerDiagnostic,
} from '@moluoxixi/config-form-designer'
import type { FieldNode } from '@moluoxixi/config-form-model'
import type { ElementPlusDesignerOption, ElementPlusOptionResolverContext, ElementPlusOptionSource } from '../../types'
import {
  areDesignerJsonValuesEqual,
  designerDiagnostic,
} from '@moluoxixi/config-form-designer'
import { normalizeElementPlusOptions, readElementPlusOptionSource } from '../composables'

export function createElementPlusOptionDiagnostics(
  context?: ElementPlusOptionResolverContext,
): (node: FieldNode, path: (string | number)[]) => DesignerDiagnostic[] {
  return (node, path) => {
    const rawSource = node.props?.optionSource
    if (rawSource === undefined)
      return []
    const source = readElementPlusOptionSource(rawSource)
    if (!source) {
      return [designerDiagnostic(
        'DESIGNER_OPTION_SOURCE_INVALID',
        'Option source must be static or reference a named dictionary or provider',
        [...path, 'props', 'optionSource'],
        'error',
        node.id,
      )]
    }
    if (source.kind === 'static')
      return []

    const resolved = resolveState(source, context)
    if (!resolved.options) {
      return [designerDiagnostic(
        resolved.code,
        resolved.message,
        [...path, 'props', 'optionSource'],
        'error',
        node.id,
      )]
    }
    if (node.defaultValue === undefined)
      return []
    if (node.defaultValue === null)
      return []

    const defaults = Array.isArray(node.defaultValue) ? node.defaultValue : [node.defaultValue]
    if (defaults.some(value => !resolved.options!.some(option => areDesignerJsonValuesEqual(option.value, value)))) {
      return [designerDiagnostic(
        'DESIGNER_DEFAULT_OPTION_UNKNOWN',
        'Default value is not present in the resolved options',
        [...path, 'defaultValue'],
        'error',
        node.id,
      )]
    }
    return []
  }
}

function resolveState(
  source: Exclude<ElementPlusOptionSource, { kind: 'static' }>,
  context: ElementPlusOptionResolverContext | undefined,
): { options?: ElementPlusDesignerOption[], code: string, message: string } {
  if (!context) {
    return {
      code: 'DESIGNER_OPTION_SOURCE_UNRESOLVED',
      message: `No Element Plus option resolver is registered for ${source.key}`,
    }
  }

  if (source.kind === 'dictionary') {
    const dictionary = context.dictionaries[source.key]
    return dictionary
      ? { options: normalizeElementPlusOptions(dictionary), code: '', message: '' }
      : {
          code: 'DESIGNER_OPTION_SOURCE_ERROR',
          message: `Unknown option dictionary: ${source.key}`,
        }
  }

  const state = context.readState(source)
  if (!state) {
    return {
      code: 'DESIGNER_OPTION_SOURCE_UNRESOLVED',
      message: `Option provider has not resolved yet: ${source.key}`,
    }
  }
  if (state.status === 'loading' || state.status === 'idle') {
    return {
      code: 'DESIGNER_OPTION_SOURCE_LOADING',
      message: `Option provider is still loading: ${source.key}`,
    }
  }
  if (state.status === 'error') {
    return {
      code: 'DESIGNER_OPTION_SOURCE_ERROR',
      message: state.error ?? `Option provider failed: ${source.key}`,
    }
  }
  return { options: state.options, code: '', message: '' }
}
