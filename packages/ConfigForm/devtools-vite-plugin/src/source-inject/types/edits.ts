export interface ScriptSegment {
  content: string
  offset: number
  line: number
  column: number
}

export interface InjectionEdit {
  end?: number
  index: number
  text: string
}
