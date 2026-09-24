import type { ProjectDialogSurface, ProjectDrawerSurface } from '@moluoxixi/config-form-model'

export type ProjectSurfaceAction
  = | { type: 'surface.rename', surfaceId: string, name: string }
    | { type: 'surface.route', surfaceId: string, route: string }
    | { type: 'surface.home', surfaceId: string }
    | { type: 'surface.move', surfaceId: string, index: number }
    | { type: 'surface.duplicate', surfaceId: string }
    | { type: 'surface.presentation', surfaceId: string, presentation: ProjectDialogSurface['presentation'] | ProjectDrawerSurface['presentation'] }
    | { type: 'surface.remove', surfaceId: string }
