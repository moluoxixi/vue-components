import type { RequestOptionsComponentProps } from '../../request/types'

export type RequestTreeSelectProps = RequestOptionsComponentProps

export type RequestTreeSelectModelValue
  = | string
    | number
    | boolean
    | Record<string, unknown>
    | Array<string | number | boolean | Record<string, unknown>>
    | null
