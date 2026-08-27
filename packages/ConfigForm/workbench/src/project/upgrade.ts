import type { WorkspaceProject } from './types'
import { normalizeProjectPath } from './path'
import { cloneWorkspaceProject } from './revision'

export const WORKSPACE_CONFIG_MODULE_PATH = normalizeProjectPath('src/form.config.ts')
const LEGACY_GENERATED_FORM_PATH = normalizeProjectPath('src/form.ts')
const APP_PATH = normalizeProjectPath('src/App.vue')

export interface WorkspaceProjectUpgradeResult {
  migrated: boolean
  project: WorkspaceProject
}

/** Point legacy Workbench projects at the editable Config module used by Source. */
export function upgradeWorkspaceConfigModule(project: WorkspaceProject): WorkspaceProjectUpgradeResult {
  if (project.manifest.generatedFormModule === WORKSPACE_CONFIG_MODULE_PATH)
    return { migrated: false, project }

  const next = cloneWorkspaceProject(project)
  const appFile = next.files[APP_PATH]
  if (appFile?.kind === 'text') {
    appFile.content = appFile.content
      .replaceAll('from \'./form\'', 'from \'./form.config\'')
      .replaceAll('from "./form"', 'from "./form.config"')
  }
  if (next.manifest.generatedFormModule === LEGACY_GENERATED_FORM_PATH)
    delete next.files[LEGACY_GENERATED_FORM_PATH]
  next.manifest.generatedFormModule = WORKSPACE_CONFIG_MODULE_PATH
  return { migrated: true, project: next }
}
