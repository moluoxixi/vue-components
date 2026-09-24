import type { PrototypeVueHostController } from './contracts'

export type PrototypeSurfaceHostExpose = Pick<
  PrototypeVueHostController,
  | 'activate'
  | 'back'
  | 'closeAll'
  | 'dismiss'
  | 'dispatch'
  | 'getRevision'
  | 'getSnapshot'
  | 'replaceSession'
  | 'valuesChanged'
>
