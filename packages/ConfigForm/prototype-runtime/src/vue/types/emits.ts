import type {
  PrototypeVueHostDiagnosticEvent,
  PrototypeVueTransitionSnapshot,
  PrototypeVueValidationFailure,
} from './contracts'

export interface PrototypeSurfaceHostEmits {
  (event: 'transition', snapshot: PrototypeVueTransitionSnapshot): void
  (event: 'diagnostics', payload: PrototypeVueHostDiagnosticEvent): void
  (event: 'validationFailed', payload: PrototypeVueValidationFailure): void
}
