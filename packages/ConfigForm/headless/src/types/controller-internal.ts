import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { Component } from 'vue'
import type { ConfigFormMeta } from './meta'
import type { ConfigFormResolvedFieldState } from './node'
import type {
  ConfigFormErrors,
  ConfigFormNode,
  ConfigFormValues,
} from './props'

export type ControllerNode<TValues extends ConfigFormValues> = ConfigFormNode<
  TValues,
  Component | string,
  unknown,
  unknown
>

export type ControllerFieldState<TValues extends ConfigFormValues> = ConfigFormResolvedFieldState<
  TValues,
  unknown,
  unknown
>

export interface ControllerValidationResult<TValues extends ConfigFormValues> {
  states: ControllerFieldState<TValues>[]
  status: 'invalid' | 'stale' | 'valid'
}

export interface ControllerMetaService {
  clearTouched: (fields?: string[]) => void
  commitMeta: () => ConfigFormMeta
  getFieldMeta: (field: string) => ConfigFormMeta['fields'][string]
  getMeta: () => ConfigFormMeta
  refreshMeta: () => ConfigFormMeta
  setTouched: {
    (): void
    (touched: boolean): void
    (fields: string | string[], touched?: boolean): void
  }
}

export type ControllerFieldStateResolver<TValues extends ConfigFormValues> = (
  values: TValues,
  projection?: ConfigFormReactionProjection<TValues>,
) => ControllerFieldState<TValues>[]

export interface ControllerResetServiceOptions<TValues extends ConfigFormValues> {
  clearTouched: (fields?: string[]) => void
  commitValues: (values: TValues, fieldsToClear?: string[]) => void
  createResetValues: () => TValues
  readValues: () => TValues
}

export interface ControllerSubmitServiceOptions<TValues extends ConfigFormValues> {
  getErrors: () => ConfigFormErrors
  getFieldStates: ControllerFieldStateResolver<TValues>
  getValues: () => TValues
  onError?: (errors: ConfigFormErrors) => void
  onSubmit?: (values: TValues) => void
  readValues: () => TValues
  setTouched: (fields: string[]) => void
  validateValues: (values: TValues) => Promise<ControllerValidationResult<TValues>>
}

export type ControllerReset = (fields?: string | string[]) => void
