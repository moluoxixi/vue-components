import type {
  ConfigFormDataSourceState,
  ConfigFormFlowAction,
  ConfigFormFlowActionContext,
  ConfigFormFlowActionDescriptor,
  ConfigFormJsonValue,
  ConfigFormValueReferenceScope,
} from '@moluoxixi/config-form-core'
import type { ConfigFormPageRuntimeLoadOptions } from '../../runtime'

export type ConfigFormRendererBuiltinActionRef
  = | 'builtin.field.set'
    | 'builtin.variable.set'
    | 'builtin.field.state'
    | 'builtin.form.validate'
    | 'builtin.form.submit'
    | 'builtin.form.reset'
    | 'builtin.dataSource.load'

export interface RendererBuiltinActionHost {
  validate: (context: ConfigFormFlowActionContext) => Promise<boolean>
  submit: (context: ConfigFormFlowActionContext) => Promise<boolean>
  reset: (context: ConfigFormFlowActionContext) => Promise<boolean>
  loadDataSource: (
    sourceId: string,
    options: ConfigFormPageRuntimeLoadOptions,
    context: ConfigFormFlowActionContext,
  ) => Promise<ConfigFormDataSourceState>
}

const SCOPE_OPTIONS = ['current', 'parent', 'root'].map(value => ({ title: value, value }))

const ACTION_DESCRIPTORS: readonly ConfigFormFlowActionDescriptor[] = [
  {
    ref: 'builtin.field.set',
    title: 'Set field',
    category: 'form',
    parameters: [
      { name: 'fieldId', title: 'Field', control: 'field', required: true },
      { name: 'value', title: 'Value', control: 'value', required: true },
      { name: 'scope', title: 'Scope', control: 'enum', defaultValue: 'current', options: SCOPE_OPTIONS },
    ],
    outputs: [{ name: 'value', title: 'Assigned value' }],
    capabilities: [],
  },
  {
    ref: 'builtin.variable.set',
    title: 'Set variable',
    category: 'form',
    parameters: [
      { name: 'variableId', title: 'Variable', control: 'variable', required: true },
      { name: 'value', title: 'Value', control: 'value', required: true },
    ],
    outputs: [{ name: 'value', title: 'Assigned value' }],
    capabilities: [],
  },
  {
    ref: 'builtin.field.state',
    title: 'Set field state',
    category: 'form',
    parameters: [
      { name: 'fieldId', title: 'Field', control: 'field', required: true },
      {
        name: 'state',
        title: 'State',
        control: 'enum',
        required: true,
        options: ['visible', 'disabled', 'readonly'].map(value => ({ title: value, value })),
      },
      { name: 'value', title: 'Enabled', control: 'boolean', required: true },
      { name: 'scope', title: 'Scope', control: 'enum', defaultValue: 'current', options: SCOPE_OPTIONS },
    ],
    outputs: [{ name: 'state', title: 'Applied state' }],
    capabilities: [],
  },
  {
    ref: 'builtin.form.validate',
    title: 'Validate form',
    category: 'form',
    parameters: [],
    outputs: [{ name: 'valid', title: 'Valid' }],
    capabilities: [],
  },
  {
    ref: 'builtin.form.submit',
    title: 'Submit form',
    category: 'form',
    parameters: [],
    outputs: [{ name: 'submitted', title: 'Submitted' }],
    capabilities: [],
  },
  {
    ref: 'builtin.form.reset',
    title: 'Reset form',
    category: 'form',
    parameters: [],
    outputs: [{ name: 'reset', title: 'Reset' }],
    capabilities: [],
  },
  {
    ref: 'builtin.dataSource.load',
    title: 'Load data source',
    category: 'data',
    parameters: [
      { name: 'dataSourceId', title: 'Data source', control: 'dataSource', required: true },
      { name: 'params', title: 'Parameters', control: 'object' },
      { name: 'force', title: 'Ignore cache', control: 'boolean', defaultValue: false },
    ],
    outputs: [{ name: 'state', title: 'Data-source state' }],
    capabilities: ['dataSourceHost.request'],
  },
]

export class ConfigFormRendererActionError extends Error {
  readonly code: string
  readonly path?: string

  constructor(code: string, message: string, path?: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.path = path
  }
}

/** JSON-safe metadata for the actions executed inside each Renderer instance. */
export function listConfigFormRendererBuiltinActionDescriptors(): ConfigFormFlowActionDescriptor[] {
  return ACTION_DESCRIPTORS.map(descriptor => structuredClone(descriptor))
}

export function createRendererBuiltinActions(
  host: RendererBuiltinActionHost,
): Record<ConfigFormRendererBuiltinActionRef, ConfigFormFlowAction> {
  const descriptor = (ref: ConfigFormRendererBuiltinActionRef) =>
    structuredClone(ACTION_DESCRIPTORS.find(item => item.ref === ref)!)
  return {
    'builtin.field.set': {
      descriptor: descriptor('builtin.field.set'),
      execute: (input, context) => {
        const value = requireRecord(input, 'builtin.field.set')
        const fieldId = requireText(value.fieldId, 'builtin.field.set', 'fieldId')
        const scope = readScope(value.scope, 'builtin.field.set')
        const setField = requireFormMethod(context.form.setField, 'builtin.field.set', 'setField')
        setField(fieldId, value.value, scope)
        return { value: value.value }
      },
    },
    'builtin.variable.set': {
      descriptor: descriptor('builtin.variable.set'),
      execute: (input, context) => {
        const value = requireRecord(input, 'builtin.variable.set')
        const variableId = requireText(value.variableId, 'builtin.variable.set', 'variableId')
        const setVariable = requireFormMethod(context.form.setVariable, 'builtin.variable.set', 'setVariable')
        setVariable(variableId, value.value)
        return { value: value.value }
      },
    },
    'builtin.field.state': {
      descriptor: descriptor('builtin.field.state'),
      execute: (input, context) => {
        const value = requireRecord(input, 'builtin.field.state')
        const fieldId = requireText(value.fieldId, 'builtin.field.state', 'fieldId')
        const state = requireEnum(value.state, ['visible', 'disabled', 'readonly'] as const, 'builtin.field.state', 'state')
        if (typeof value.value !== 'boolean')
          throw actionInputError('builtin.field.state', 'value', 'a boolean')
        const scope = readScope(value.scope, 'builtin.field.state')
        const setFieldState = requireFormMethod(context.form.setFieldState, 'builtin.field.state', 'setFieldState')
        setFieldState(fieldId, state, value.value, scope)
        return { state, value: value.value }
      },
    },
    'builtin.form.validate': {
      descriptor: descriptor('builtin.form.validate'),
      execute: async (_input, context) => {
        context.signal.throwIfAborted()
        const valid = await host.validate(context)
        context.signal.throwIfAborted()
        return { valid }
      },
    },
    'builtin.form.submit': {
      descriptor: descriptor('builtin.form.submit'),
      execute: async (_input, context) => {
        context.signal.throwIfAborted()
        const submitted = await host.submit(context)
        context.signal.throwIfAborted()
        return { submitted }
      },
    },
    'builtin.form.reset': {
      descriptor: descriptor('builtin.form.reset'),
      execute: async (_input, context) => {
        context.signal.throwIfAborted()
        return { reset: await host.reset(context) }
      },
    },
    'builtin.dataSource.load': {
      descriptor: descriptor('builtin.dataSource.load'),
      execute: async (input, context) => {
        const value = requireRecord(input, 'builtin.dataSource.load')
        const dataSourceId = requireText(value.dataSourceId, 'builtin.dataSource.load', 'dataSourceId')
        if (value.force !== undefined && typeof value.force !== 'boolean')
          throw actionInputError('builtin.dataSource.load', 'force', 'a boolean')
        if (value.params !== undefined && !isRecord(value.params))
          throw actionInputError('builtin.dataSource.load', 'params', 'an object')
        context.signal.throwIfAborted()
        const state = await host.loadDataSource(dataSourceId, {
          force: value.force as boolean | undefined,
          // Core already resolved action input. Literal wrapping prevents a second interpretation.
          params: value.params === undefined
            ? undefined
            : Object.fromEntries(
                Object.entries(value.params as Record<string, ConfigFormJsonValue>)
                  .map(([key, item]) => [key, { $ref: { kind: 'literal' as const, value: item } }]),
              ),
          scope: context.event.scope,
          signal: context.signal,
        }, context)
        context.signal.throwIfAborted()
        if (state.status === 'error') {
          throw new ConfigFormRendererActionError(
            state.error?.code ?? 'FLOW_DATA_SOURCE_FAILED',
            state.error?.message ?? `Data source ${dataSourceId} failed.`,
            state.error?.path ?? 'config.input.dataSourceId',
          )
        }
        return { state }
      },
    },
  }
}

function requireRecord(input: unknown, action: string): Record<string, unknown> {
  if (!isRecord(input))
    throw new ConfigFormRendererActionError('FLOW_ACTION_INPUT_INVALID', `${action} requires an object input.`, 'config.input')
  return input
}

function requireText(value: unknown, action: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw actionInputError(action, field, 'a non-empty string')
  return value
}

function requireEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  action: string,
  field: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value))
    throw actionInputError(action, field, `one of ${allowed.join(', ')}`)
  return value
}

function readScope(value: unknown, action: string): ConfigFormValueReferenceScope {
  if (value === undefined)
    return 'current'
  return requireEnum(value, ['current', 'parent', 'root'] as const, action, 'scope')
}

function requireFormMethod<T extends (...args: never[]) => unknown>(
  method: T | undefined,
  action: string,
  name: string,
): T {
  if (!method)
    throw new ConfigFormRendererActionError('FLOW_ACTION_RUNTIME_UNAVAILABLE', `${action} requires Renderer form.${name}.`, `form.${name}`)
  return method
}

function actionInputError(action: string, field: string, expected: string): ConfigFormRendererActionError {
  return new ConfigFormRendererActionError(
    'FLOW_ACTION_INPUT_INVALID',
    `${action} requires "${field}" to be ${expected}.`,
    `config.input.${field}`,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
