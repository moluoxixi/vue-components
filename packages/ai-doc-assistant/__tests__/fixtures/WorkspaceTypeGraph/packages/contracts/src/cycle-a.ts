import type { CycleB } from './cycle-b'

export interface CycleA {
  label: string
  next?: CycleB
}
