import type { RequestOptionsComponentProps } from '../../request/types'

export type RequestCascaderProps = RequestOptionsComponentProps

export type RequestCascaderModelValue
  = | string
    | number
    | Record<string, unknown>
    | Array<
      | string
      | number
      | Record<string, unknown>
      | Array<string | number | Record<string, unknown>>
    >
    | null
