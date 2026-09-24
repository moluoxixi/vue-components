import type {
  ComponentContract,
  ProjectDocument,
  ProjectSurface,
} from '@moluoxixi/config-form-model'
import {
  createComponentContractRegistry,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'

export const contracts: ComponentContract[] = [
  {
    key: 'field.input',
    version: '1',
    kind: 'field',
    semanticTriggers: [],
    stateProjectionProperties: [],
    datasetBindings: [{ key: 'options', projectionKinds: ['options'] }],
    resourceBindings: [],
    props: [{ key: 'placeholder', path: ['props', 'placeholder'] }],
    bindings: [{ name: 'model', valueProp: 'modelValue', trigger: 'update:modelValue' }],
    slots: [],
    allowedParents: [{ component: 'layout.section', slot: 'default' }],
    defaults: { clearable: true, placeholder: 'Default placeholder' },
  },
  {
    key: 'layout.section',
    version: '1',
    kind: 'layout',
    semanticTriggers: [],
    stateProjectionProperties: [],
    datasetBindings: [],
    resourceBindings: [],
    props: [],
    bindings: [],
    slots: [{ name: 'default', accepts: ['field', 'layout', 'element'] }],
    allowedParents: [],
    defaults: { gap: 12 },
  },
  {
    key: 'element.action',
    version: '1',
    kind: 'element',
    semanticTriggers: ['activate'],
    stateProjectionProperties: [['label']],
    datasetBindings: [],
    resourceBindings: [],
    props: [{ key: 'label', path: ['props', 'label'] }],
    bindings: [],
    slots: [],
    allowedParents: [{ component: 'layout.section', slot: 'default' }],
    defaults: { label: 'Continue' },
  },
  {
    key: 'element.image',
    version: '1',
    kind: 'element',
    semanticTriggers: [],
    stateProjectionProperties: [],
    datasetBindings: [],
    resourceBindings: [{ key: 'source', mediaTypes: ['image/png'] }],
    props: [],
    bindings: [],
    slots: [],
    allowedParents: [],
    defaults: { alt: '' },
  },
]

function actionSurface(
  id: string,
  targetSurfaceId: string,
): ProjectSurface['graph'] {
  return {
    version: SURFACE_GRAPH_VERSION,
    props: {},
    form: {},
    root: [{ nodeId: `${id}-action`, placement: {} }],
    nodesById: {
      [`${id}-action`]: {
        id: `${id}-action`,
        component: 'element.action',
        kind: 'element',
        props: { label: `Open ${targetSurfaceId}` },
      },
    },
  }
}

export function createProjectDocument(): ProjectDocument {
  const registry = createComponentContractRegistry(contracts, {
    adapter: 'fixture',
    version: '1.0.0',
  })
  return {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'project',
    name: 'Surface project',
    homeSurfaceId: 'home',
    surfaceOrder: ['home', 'editor', 'details'],
    surfacesById: {
      home: {
        id: 'home',
        name: 'Home',
        kind: 'page',
        route: '/',
        parameters: [],
        outputs: [],
        interactions: [{
          kind: 'primaryUiAction',
          id: 'open-editor',
          nodeId: 'open-editor',
          trigger: 'activate',
          action: { kind: 'open', targetSurfaceId: 'editor', parameters: [] },
        }],
        graph: {
          version: SURFACE_GRAPH_VERSION,
          props: { title: 'Profile' },
          form: { columns: 24 },
          root: [{ nodeId: 'section', placement: {} }],
          nodesById: {
            'section': {
              id: 'section',
              component: 'layout.section',
              kind: 'layout',
              props: {},
              slots: {
                default: [
                  { nodeId: 'name', placement: { span: 12 } },
                  { nodeId: 'open-editor', placement: { span: 12 } },
                ],
              },
            },
            'name': {
              id: 'name',
              component: 'field.input',
              kind: 'field',
              field: 'name',
              label: 'Name',
              defaultValue: 'Ada',
              required: true,
              requiredMessage: 'Name is required',
              validation: {
                version: 2,
                base: { type: 'string' },
                rules: [{ kind: 'minLength', value: 2 }],
              },
              props: { placeholder: 'Your name' },
              datasetBindings: {
                options: {
                  datasetId: 'people',
                  projection: {
                    kind: 'options',
                    labelPath: ['label'],
                    valuePath: ['id'],
                  },
                },
              },
            },
            'open-editor': {
              id: 'open-editor',
              component: 'element.action',
              kind: 'element',
              props: { label: 'Edit' },
            },
          },
        },
      },
      editor: {
        id: 'editor',
        name: 'Editor',
        kind: 'dialog',
        parameters: [{ name: 'recordId', required: false }],
        outputs: [{ name: 'saved' }],
        interactions: [{
          kind: 'primaryUiAction',
          id: 'open-details',
          nodeId: 'editor-action',
          trigger: 'activate',
          action: { kind: 'open', targetSurfaceId: 'details', parameters: [] },
        }],
        presentation: {
          kind: 'dialog',
          title: 'Editor',
          width: { desktop: { value: 640, unit: 'px' } },
          mask: true,
          close: { escape: true, mask: true, button: true },
        },
        graph: actionSurface('editor', 'details'),
      },
      details: {
        id: 'details',
        name: 'Details',
        kind: 'drawer',
        parameters: [],
        outputs: [],
        interactions: [{
          kind: 'primaryUiAction',
          id: 'open-editor-again',
          nodeId: 'details-action',
          trigger: 'activate',
          action: { kind: 'open', targetSurfaceId: 'editor', parameters: [] },
        }],
        presentation: {
          kind: 'drawer',
          title: 'Details',
          placement: 'right',
          size: { desktop: { value: 40, unit: '%' } },
          mask: true,
          close: { escape: true, mask: true, button: true },
        },
        graph: actionSurface('details', 'editor'),
      },
    },
    datasetOrder: ['people'],
    datasetsById: {
      people: {
        id: 'people',
        name: 'People',
        rows: [{ id: 'ada', label: 'Ada' }],
      },
    },
    resources: {
      logo: {
        id: 'logo',
        name: 'Logo',
        kind: 'url',
        url: '/logo.png',
        mediaType: 'image/png',
      },
    },
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: structuredClone(registry.lock),
    settings: { locale: 'zh-CN' },
  }
}

export function createCompilerFixture(editVersion = 1) {
  const registry = createComponentContractRegistry(contracts, {
    adapter: 'fixture',
    version: '1.0.0',
  })
  const document = createProjectDocument()
  return {
    contractRegistry: registry,
    registry: createRegistryContractSnapshot(registry),
    snapshot: createProjectSnapshot(document, editVersion),
  }
}
