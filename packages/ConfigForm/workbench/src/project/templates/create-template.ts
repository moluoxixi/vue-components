import type {
  PageGraph,
  ProjectDocument,
  ProjectPage,
  RegistryLock,
} from '@moluoxixi/config-form-model'
import type {
  ProjectPageTemplateInput,
  ProjectTemplate,
  ProjectTemplateAdapter,
  ProjectTemplateInput,
} from './types'
import {
  assertProjectDocument,
  PAGE_GRAPH_VERSION,
  PROJECT_DOCUMENT_VERSION,
} from '@moluoxixi/config-form-model'
import { WorkbenchProjectError } from '../errors'

interface TemplateDefinition {
  adapter: ProjectTemplateAdapter
  description: string
  id: string
  order: number
  title: string
}

export function createProfileGraph(adapter: ProjectTemplateAdapter): PageGraph {
  const prefix = adapter === 'element-plus' ? 'element' : 'antd'
  return {
    version: PAGE_GRAPH_VERSION,
    props: {},
    form: {
      columns: 24,
      fieldSpan: 24,
      gap: '16px',
      labelPosition: 'left',
      responsive: {
        tablet: { columns: 12, fieldSpan: 12 },
        mobile: { columns: 1, fieldSpan: 1 },
      },
    },
    root: [
      { nodeId: 'profile-name', placement: { span: 12 } },
      { nodeId: 'profile-role', placement: { span: 12 } },
      { nodeId: 'profile-active', placement: { span: 24 } },
    ],
    nodesById: {
      'profile-name': {
        id: 'profile-name',
        kind: 'field',
        component: `${prefix}.input`,
        field: 'name',
        label: 'Name',
        defaultValue: '',
        props: { placeholder: 'Enter your name' },
        events: {},
        bindings: {},
      },
      'profile-role': {
        id: 'profile-role',
        kind: 'field',
        component: `${prefix}.select`,
        field: 'role',
        label: 'Role',
        defaultValue: 'developer',
        props: {
          options: [
            { label: 'Developer', value: 'developer' },
            { label: 'Designer', value: 'designer' },
          ],
          placeholder: 'Select a role',
        },
        events: {},
        bindings: {},
      },
      'profile-active': {
        id: 'profile-active',
        kind: 'field',
        component: `${prefix}.switch`,
        field: 'active',
        label: 'Active',
        defaultValue: true,
        props: {},
        events: {},
        bindings: {},
      },
    },
  }
}

export function createBlankGraph(): PageGraph {
  return {
    version: PAGE_GRAPH_VERSION,
    props: {},
    form: {
      columns: 24,
      fieldSpan: 24,
      gap: '16px',
      labelPosition: 'left',
      responsive: {
        tablet: { columns: 12, fieldSpan: 12 },
        mobile: { columns: 1, fieldSpan: 1 },
      },
    },
    root: [],
    nodesById: {},
  }
}

function createPage(adapter: ProjectTemplateAdapter, input: ProjectPageTemplateInput): ProjectPage {
  return {
    id: input.id,
    name: input.name,
    route: input.route,
    graph: createProfileGraph(adapter),
    flows: [],
  }
}

function createProject(
  adapter: ProjectTemplateAdapter,
  input: ProjectTemplateInput,
  registryLock: RegistryLock,
): ProjectDocument {
  const page = createPage(adapter, { id: 'home', name: input.name, route: '/' })
  return assertProjectDocument({
    schemaVersion: PROJECT_DOCUMENT_VERSION,
    id: input.id,
    name: input.name,
    homePageId: page.id,
    pageOrder: [page.id],
    pagesById: { [page.id]: page },
    registryLock,
    settings: {},
    resources: {},
  })
}

function createTemplate(definition: TemplateDefinition): ProjectTemplate {
  return {
    ...definition,
    version: 1,
    createPage: input => createPage(definition.adapter, input),
    createProject: (input, registryLock) => createProject(definition.adapter, input, registryLock),
  }
}

export const elementProfileTemplate = createTemplate({
  adapter: 'element-plus',
  description: 'Element Plus profile form with responsive ConfigForm fields.',
  id: 'element-profile',
  order: 10,
  title: 'Element Plus profile',
})

export const antdProfileTemplate = createTemplate({
  adapter: 'antd-vue',
  description: 'Ant Design Vue profile form with the same portable graph.',
  id: 'antd-profile',
  order: 20,
  title: 'Ant Design Vue profile',
})

export function createProjectTemplateRegistry(templates: ProjectTemplate[]): ReadonlyMap<string, ProjectTemplate> {
  const registry = new Map<string, ProjectTemplate>()
  for (const template of [...templates].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))) {
    if (!/^[a-z][a-z0-9-]*$/.test(template.id))
      throw new WorkbenchProjectError('TEMPLATE_INVALID', `[config-form-workbench] invalid template id "${template.id}"`)
    if (registry.has(template.id))
      throw new WorkbenchProjectError('TEMPLATE_DUPLICATE', `[config-form-workbench] template "${template.id}" already exists`)
    registry.set(template.id, template)
  }
  return registry
}
