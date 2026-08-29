export { default as ConfigFormRenderer } from './ConfigFormRenderer.vue'
export { createConfigFormRendererExpose } from './expose'
export { withConfigFormInstall } from './install'
export type { InstallableConfigFormComponent } from './install'
export { resolveConfigFormFieldLayout } from './layout'
export type * from './layout'
export { resolveConfigFormLayout, resolveConfigFormNodeSpan } from './responsive'
export type * from './responsive'
/**
 * Shared RuntimeSurface entry. It intentionally aliases ConfigFormRenderer's
 * recursive renderer so existing adapters and new Design/Preview surfaces
 * cannot drift into separate component trees.
 */
export { default as RuntimeSurface } from './RuntimeSurface.vue'
export type * from './types'
