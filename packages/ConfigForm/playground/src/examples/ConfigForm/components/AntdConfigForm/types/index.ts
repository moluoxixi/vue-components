export interface AntdOption {
  label: string
  value: string
  children?: AntdOption[]
}

export interface AntdTreeOption {
  title: string
  value: string
  children?: AntdTreeOption[]
}

export interface AntdKnownValues {
  autoComplete: string
  cascader: string[]
  checkbox: boolean
  checkboxGroup: string[]
  date: string
  input: string
  inputNumber: number
  password: string
  radio: string
  range: string[]
  rate: number
  search: string
  select: string
  slider: number
  switchValue: boolean
  textarea: string
  time: string
  timeRange: string[]
  treeSelect: string
}

export interface AntdLinkedValues extends AntdKnownValues {
  advanced: boolean
  enterpriseName: string
  marketing: boolean
  marketingNote: string
  notifyChannel: string
  planType: string
  scheduledTime: string
  seatCount: number
  seatNote: string
}

export type AntdFieldKey<TValues extends AntdKnownValues> = Extract<keyof TValues, string>
