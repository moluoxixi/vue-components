import type { CycleA } from './cycle-a'

export interface CycleB {
  previous?: CycleA
  value: number
}
