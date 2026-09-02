export class ConfigFormError<Context extends Record<string, unknown> = Record<string, unknown>> extends Error {
  readonly code: string
  readonly context: Context

  constructor(code: string, message: string, context: Context = {} as Context) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.context = context
  }
}
