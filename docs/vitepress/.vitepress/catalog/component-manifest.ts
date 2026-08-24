import type {
  ElementPlusDocsProjectComponent,
  ElementPlusDocsProjectComponentGroup,
} from '@moluoxixi/vitepress-theme-element-plus'
import { resolveElementPlusDocsProject } from '@moluoxixi/vitepress-theme-element-plus'
import projectConfig from '../../element-plus-docs.config.ts'

export type ComponentIconName
  = | 'blocks'
    | 'calendar-range'
    | 'copy'
    | 'file-pen-line'
    | 'form-input'
    | 'git-branch'
    | 'list-filter'
    | 'panel-top-open'
    | 'rows-3'
    | 'scan-text'
    | 'table-properties'
    | 'text-cursor-input'
    | 'tree-pine'

export type DocComponent = ElementPlusDocsProjectComponent & { icon: ComponentIconName }
export type DocComponentGroup = Omit<ElementPlusDocsProjectComponentGroup, 'items'> & {
  items: DocComponent[]
}

export const docsProject = resolveElementPlusDocsProject(projectConfig)

/** 文档导航、总览、API 抽取和仓库元数据共同使用的组件清单。 */
export const componentGroups = docsProject.components as DocComponentGroup[]
export const documentedComponents = componentGroups.flatMap(group => group.items)
export const documentedComponentNames = documentedComponents.map(component => component.name)
export const documentedApiComponentEntries = Array.from(
  new Set(documentedComponents.map(component => component.apiEntry)),
)

export function getDocumentedComponent(componentName: string): DocComponent {
  const component = documentedComponents.find(candidate => candidate.name === componentName)
  if (!component)
    throw new Error(`Unknown documented component: ${componentName}`)
  return component
}
