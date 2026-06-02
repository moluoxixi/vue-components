/** ConfigForm 公共错误基类，承载稳定错误码和上下文。 */
export class ConfigFormError<Context extends Record<string, unknown> = Record<string, unknown>> extends Error {
  /** 供调用方稳定分支判断的错误码。 */
  readonly code: string

  /** 便于调试和日志记录的结构化上下文。 */
  readonly context: Context

  constructor(
    code: string,
    message: string,
    context: Context = {} as Context,
  ) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.context = context
  }
}
