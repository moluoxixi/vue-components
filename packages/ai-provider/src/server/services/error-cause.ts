import type { AiProviderErrorCode, AiProviderErrorOptions } from '../../shared'
import { AiProviderError } from '../../shared'

const causes = new WeakMap<AiProviderError, unknown>()

export interface CreateAiProviderErrorOptions extends AiProviderErrorOptions {
  cause?: unknown
}

export function createAiProviderError(
  code: AiProviderErrorCode,
  message: string,
  options: CreateAiProviderErrorOptions = {},
): AiProviderError {
  const error = new AiProviderError(code, message, options)
  if (options.cause !== undefined)
    causes.set(error, options.cause)
  return error
}

/** Server-only diagnostic access. Never serialize this cause to a client. */
export function getAiProviderErrorCause(error: AiProviderError): unknown {
  return causes.get(error)
}
