const optionDefaults = [
  { label: 'Option A', value: 'a' },
  { label: 'Option B', value: 'b' },
]

export function defaultOptions(): typeof optionDefaults {
  return optionDefaults.map(option => ({ ...option }))
}
