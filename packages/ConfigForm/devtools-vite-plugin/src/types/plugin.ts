import type { EditorCommand } from './open-in-editor'

export interface ConfigFormDevtoolsPluginOptions {
  packageNames?: string[]
  allowRoots?: string[]
  editor?: string | EditorCommand
}
