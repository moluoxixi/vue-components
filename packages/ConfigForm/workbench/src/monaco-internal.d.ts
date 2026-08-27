declare module 'monaco-editor/esm/vs/language/typescript/tsMode' {
  import type { languages } from 'monaco-editor'

  export function setupTypeScript(defaults: typeof languages.typescript.typescriptDefaults): void
}
