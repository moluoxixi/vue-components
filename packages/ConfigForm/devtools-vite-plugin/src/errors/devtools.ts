import { ConfigFormError } from '@moluoxixi/config-form'

export class ConfigFormDevtoolsPluginError extends ConfigFormError<Record<string, unknown>> {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super('CONFIG_FORM_DEVTOOLS_PLUGIN_ERROR', message, context)
    this.name = 'ConfigFormDevtoolsPluginError'
  }
}

export class ConfigFormDevtoolsHttpError extends ConfigFormError<Record<string, unknown>> {
  readonly statusCode: number

  constructor(
    statusCode: number,
    message: string,
    context: Record<string, unknown> = {},
  ) {
    super('CONFIG_FORM_DEVTOOLS_HTTP_ERROR', message, { ...context, statusCode })
    this.name = 'ConfigFormDevtoolsHttpError'
    this.statusCode = statusCode
  }
}
