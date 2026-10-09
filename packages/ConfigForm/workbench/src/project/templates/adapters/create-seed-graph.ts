import type { SurfaceFieldNode, SurfaceGraph } from '@moluoxixi/config-form-model'
import type { ProjectTemplateAdapter } from '../types'
import {
  FORM_LABEL_WIDTH_DEFAULT_PX,
  FORM_LABEL_WIDTH_MOBILE_DEFAULT_PX,
  FORM_LABEL_WIDTH_TABLET_DEFAULT_PX,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'

export function createProfileGraph(adapter: ProjectTemplateAdapter): SurfaceGraph {
  const prefix = adapter === 'element-plus' ? 'element' : 'antd'
  return {
    version: SURFACE_GRAPH_VERSION,
    props: {},
    form: {
      columns: 24,
      fieldSpan: 24,
      labelPosition: 'left',
      labelWidth: FORM_LABEL_WIDTH_DEFAULT_PX,
      responsive: {
        tablet: { columns: 12, fieldSpan: 12, labelWidth: FORM_LABEL_WIDTH_TABLET_DEFAULT_PX },
        mobile: { columns: 1, fieldSpan: 1, labelWidth: FORM_LABEL_WIDTH_MOBILE_DEFAULT_PX },
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
      },
      'profile-active': {
        id: 'profile-active',
        kind: 'field',
        component: `${prefix}.switch`,
        field: 'active',
        label: 'Active',
        defaultValue: true,
        props: {},
      },
    },
  }
}

export function createBlankGraph(): SurfaceGraph {
  return {
    version: SURFACE_GRAPH_VERSION,
    props: {},
    form: {
      columns: 24,
      fieldSpan: 24,
      labelPosition: 'left',
      labelWidth: FORM_LABEL_WIDTH_DEFAULT_PX,
      responsive: {
        tablet: { columns: 12, fieldSpan: 12, labelWidth: FORM_LABEL_WIDTH_TABLET_DEFAULT_PX },
        mobile: { columns: 1, fieldSpan: 1, labelWidth: FORM_LABEL_WIDTH_MOBILE_DEFAULT_PX },
      },
    },
    root: [],
    nodesById: {},
  }
}

/** Task seeds include ready-to-test validation, help and mobile layout. */
export function createTaskGraph(adapter: ProjectTemplateAdapter, task: 'approval' | 'survey'): SurfaceGraph {
  const prefix = adapter === 'element-plus' ? 'element' : 'antd'
  const field = (
    name: string,
    component: string,
    label: string,
    extra: Partial<SurfaceFieldNode> = {},
  ): SurfaceFieldNode => ({
    id: `${task}-${name}`,
    kind: 'field',
    component: `${prefix}.${component}`,
    field: name,
    label,
    props: {},
    ...extra,
  })
  const nodes
    = task === 'approval'
      ? [
          field('requester', 'input', 'Applicant', {
            required: true,
            description: 'Use the name shown in your employee record.',
            validation: { version: 2, base: { type: 'string' }, rules: [{ kind: 'minLength', value: 2 }] },
          }),
          field('department', 'select', 'Department', {
            required: true,
            props: { options: ['Engineering', 'Design', 'Operations'].map(value => ({ label: value, value })) },
          }),
          field('amount', 'input-number', 'Amount', {
            required: true,
            defaultValue: 1,
            help: 'Enter the amount in your local currency.',
            validation: { version: 2, base: { type: 'number' }, rules: [{ kind: 'min', value: 1 }] },
            props: { min: 1 },
          }),
          field('reason', 'textarea', 'Business reason', {
            required: true,
            help: 'Describe the purpose and expected outcome.',
            validation: { version: 2, base: { type: 'string' }, rules: [{ kind: 'minLength', value: 10 }] },
            props: { rows: 4 },
          }),
        ]
      : [
          field('contact', 'input', 'Contact email', {
            description: 'Optional. Only used if you want a follow-up.',
            validation: { version: 2, base: { type: 'string' }, optional: true, rules: [{ kind: 'email' }] },
          }),
          field('rating', 'select', 'Overall experience', {
            required: true,
            props: { options: ['Excellent', 'Good', 'Fair', 'Poor'].map(value => ({ label: value, value })) },
          }),
          field('feedback', 'textarea', 'What should we improve?', {
            required: true,
            help: 'A concrete example helps us understand your experience.',
            validation: { version: 2, base: { type: 'string' }, rules: [{ kind: 'minLength', value: 5 }] },
            props: { rows: 5 },
          }),
          field('followUp', 'switch', 'Allow follow-up', {
            defaultValue: false,
            warning: 'Enable only if you have provided a contact email.',
          }),
        ]
  const graph = createBlankGraph()
  graph.form = { ...graph.form, labelPosition: 'top' }
  graph.nodesById = Object.fromEntries(nodes.map(node => [node.id, node]))
  graph.root = nodes.map((node, index) => ({ nodeId: node.id, placement: { span: index < 2 ? 12 : 24 } }))
  return graph
}
