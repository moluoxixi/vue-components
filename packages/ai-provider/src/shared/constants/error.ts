import type { AiProviderErrorCode } from '../types'

export const AI_PROVIDER_ERROR_CODES = [
  'INVALID_PROVIDER_CONFIG',
] as const satisfies readonly AiProviderErrorCode[]
