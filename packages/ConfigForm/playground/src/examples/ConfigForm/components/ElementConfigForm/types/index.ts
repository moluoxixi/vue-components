export interface ElementOption extends Record<string, unknown> {
  label: string
  value: string
  children?: ElementOption[]
}

export interface ElementKnownValues {
  autocomplete: string
  cascader: string
  checkbox: boolean
  checkboxGroup: string[]
  color: string
  date: string
  input: string
  inputNumber: number
  radio: string
  rate: number
  select: string
  selectV2: string
  slider: number
  switchValue: boolean
  textarea: string
  time: string
  timeSelect: string
  treeSelect: string
}

export interface ElementLinkedValues extends ElementKnownValues {
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

export type ElementStressValues = Record<string, string>
export type ElementFieldKey<TValues extends ElementKnownValues> = Extract<keyof TValues, string>
