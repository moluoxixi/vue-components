import type { WorkbenchController } from './controller'
import type { WorkbenchUiStore } from './ui-store'

/**
 * Route ⇄ workspace synchronization input.
 *
 * The composable is invoked from the application shell, which already owns both
 * contexts, so they are passed explicitly instead of being injected.
 */
export interface WorkbenchRouteSyncOptions {
  readonly controller: WorkbenchController
  readonly ui: WorkbenchUiStore
}
