import type { ElementPlusDocsExternalProject } from './vue-project'
import { submitElementPlusDocsProjectForm } from './submit-form'

const defaultStackBlitzUrl = 'https://stackblitz.com/run'

export interface ElementPlusDocsStackBlitzOptions {
  openFile?: string
  startScript?: string
  theme?: 'dark' | 'light'
  url?: string
  view?: 'editor' | 'preview'
}

export interface ElementPlusDocsStackBlitzProject {
  description?: string
  files: Readonly<Record<string, string>>
  template: 'node'
  title: string
}

export function createElementPlusDocsStackBlitzProject(
  project: ElementPlusDocsExternalProject,
): ElementPlusDocsStackBlitzProject {
  return {
    description: project.description,
    files: project.files,
    template: 'node',
    title: project.title,
  }
}

export function openElementPlusDocsStackBlitz(
  project: ElementPlusDocsExternalProject,
  options: ElementPlusDocsStackBlitzOptions = {},
): void {
  const stackBlitzProject = createElementPlusDocsStackBlitzProject(project)
  const action = new URL(options.url ?? defaultStackBlitzUrl)
  action.searchParams.set('file', options.openFile ?? 'src/App.vue')
  action.searchParams.set('startScript', options.startScript ?? 'dev')
  if (options.theme)
    action.searchParams.set('theme', options.theme)
  if (options.view)
    action.searchParams.set('view', options.view)

  const fields: Record<string, string> = {
    'project[template]': stackBlitzProject.template,
    'project[title]': stackBlitzProject.title,
  }
  if (stackBlitzProject.description)
    fields['project[description]'] = stackBlitzProject.description

  for (const [path, content] of Object.entries(stackBlitzProject.files)) {
    const encodedPath = path.replaceAll('[', '%5B').replaceAll(']', '%5D')
    fields[`project[files][${encodedPath}]`] = content
  }

  submitElementPlusDocsProjectForm(action.toString(), fields)
}
