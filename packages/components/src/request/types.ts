import type { QueryKeyBase } from '@moluoxixi/hooks'

export type RequestOptionRecord = Record<string, any>
export type RequestParamsRecord = Record<string, unknown>

export interface RequestOptionsComponentProps<
  TOption extends RequestOptionRecord = RequestOptionRecord,
  TParams extends RequestParamsRecord = RequestParamsRecord,
> {
  query: (params: TParams) => Promise<TOption[]>
  params?: TParams
  cacheKey?: QueryKeyBase
  enabled?: boolean
  staleTime?: number
}

export interface RequestOptionsComponentEmits<TOption extends RequestOptionRecord = RequestOptionRecord> {
  (event: 'loaded', options: TOption[]): void
  (event: 'error', error: Error): void
}
