export type ConfigFormJsonPrimitive = boolean | null | number | string
export type ConfigFormJsonValue
  = | ConfigFormJsonPrimitive
    | ConfigFormJsonValue[]
    | { [key: string]: ConfigFormJsonValue }

export interface ConfigFormJsonObject { [key: string]: ConfigFormJsonValue }
