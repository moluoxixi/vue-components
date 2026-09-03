import type {
  DesignerFieldMaterialDefinition,
  DesignerFieldMaterialOptions,
  DesignerPropertySetterDefinition,
} from '../types'
import {
  cloneDesignerJsonValue,
  createDesignerFieldPropertyDefaults,
  createDesignerFieldPropertySetter,
  resolveDesignerDefaultField,
} from '../utils/field-material'

/** Defines the common one-field material shape without exposing node-factory boilerplate. */
export function defineDesignerFieldMaterial(
  options: DesignerFieldMaterialOptions,
): DesignerFieldMaterialDefinition {
  const {
    component,
    defaultField = resolveDesignerDefaultField(options.key),
    defaultLabel = options.title,
    defaultProps = {},
    props = {},
    runtime = {},
    setters = [],
    value,
    version = 1,
    ...definition
  } = options
  const initialProps = {
    ...structuredClone(defaultProps),
    ...createDesignerFieldPropertyDefaults(props),
  }
  const initialDefaultValue = value?.default === undefined
    ? undefined
    : cloneDesignerJsonValue(value.default)
  const generatedSetters: DesignerPropertySetterDefinition[] = [
    ...(value
      ? [{
          key: 'defaultValue',
          label: value.label ?? 'Default value',
          path: ['defaultValue'],
          control: 'defaultValue' as const,
          valueKind: value.kind,
        }]
      : []),
    ...Object.entries(props).map(([key, prop]) => createDesignerFieldPropertySetter(key, prop)),
    ...setters,
  ]

  return {
    ...definition,
    version,
    kind: 'field',
    runtime: { ...runtime, component },
    setters: generatedSetters,
    createNode: ({ id, field = defaultField }) => ({
      id,
      kind: 'field',
      component: definition.key,
      field,
      label: defaultLabel,
      props: structuredClone(initialProps),
      ...(initialDefaultValue === undefined
        ? {}
        : { defaultValue: cloneDesignerJsonValue(initialDefaultValue) }),
    }),
  }
}
