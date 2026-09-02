import type {
  PageGraph,
} from '@moluoxixi/config-form-model'
import type {
  ProjectTemplateAdapter,
} from '../types'
import { PAGE_GRAPH_VERSION } from '@moluoxixi/config-form-model'

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
