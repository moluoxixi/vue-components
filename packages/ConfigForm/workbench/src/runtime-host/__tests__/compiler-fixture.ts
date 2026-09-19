import type { ComponentContract, ProjectDocument } from '@moluoxixi/config-form-model'
import {
  createComponentContractRegistry,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'

const contracts: ComponentContract[] = [{
  key: 'field.input',
  version: '1',
  kind: 'field',
  semanticTriggers: [],
  stateProjectionProperties: [],
  datasetBindings: [],
  resourceBindings: [],
  props: [],
  bindings: [{ name: 'model', valueProp: 'modelValue', trigger: 'update:modelValue' }],
  slots: [],
  allowedParents: [],
  defaults: {},
}, {
  key: 'element.action',
  version: '1',
  kind: 'element',
  semanticTriggers: ['activate', 'submit'],
  stateProjectionProperties: [],
  datasetBindings: [],
  resourceBindings: [],
  props: [],
  bindings: [],
  slots: [],
  allowedParents: [],
  defaults: {},
}]

export function createCompilerFixture(editVersion = 1) {
  const registry = createComponentContractRegistry(contracts, {
    adapter: 'fixture',
    version: '1.0.0',
  })
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'project',
    name: 'Runtime Host fixture',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    surfacesById: {
      home: {
        id: 'home',
        name: 'Home',
        kind: 'page',
        route: '/',
        parameters: [],
        outputs: [],
        interactions: [],
        graph: {
          version: SURFACE_GRAPH_VERSION,
          props: {},
          form: {},
          root: [{ nodeId: 'name', placement: {} }],
          nodesById: {
            name: {
              id: 'name',
              component: 'field.input',
              kind: 'field',
              field: 'name',
              defaultValue: 'Ada',
              props: {},
            },
          },
        },
      },
    },
    datasetOrder: [],
    datasetsById: {},
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: structuredClone(registry.lock),
    settings: {},
  }
  return {
    registry: createRegistryContractSnapshot(registry),
    snapshot: createProjectSnapshot(document, editVersion),
  }
}

export function createExperienceCompilerFixture(
  editVersion = 1,
  homeTrigger: 'activate' | 'submit' = 'activate',
) {
  const registry = createComponentContractRegistry(contracts, {
    adapter: 'fixture',
    version: '1.0.0',
  })
  const actionGraph = (nodeId: string): ProjectDocument['surfacesById'][string]['graph'] => ({
    version: SURFACE_GRAPH_VERSION,
    props: {},
    form: {},
    root: [{ nodeId, placement: {} }],
    nodesById: {
      [nodeId]: {
        id: nodeId,
        component: 'element.action',
        kind: 'element',
        props: {},
      },
    },
  })
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'project',
    name: 'Runtime Host Experience fixture',
    homeSurfaceId: 'home',
    surfaceOrder: ['home', 'dialog', 'drawer'],
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
          id: 'open-dialog',
          nodeId: 'home-action',
          trigger: homeTrigger,
          action: { kind: 'open', targetSurfaceId: 'dialog', parameters: [] },
        }],
        graph: actionGraph('home-action'),
      },
      dialog: {
        id: 'dialog',
        name: 'Dialog',
        kind: 'dialog',
        presentation: {
          kind: 'dialog',
          title: 'Dialog',
          width: { desktop: { value: 480, unit: 'px' } },
          mask: true,
          close: { escape: true, mask: true, button: true },
        },
        parameters: [],
        outputs: [],
        interactions: [{
          kind: 'primaryUiAction',
          id: 'open-drawer',
          nodeId: 'dialog-action',
          trigger: 'activate',
          action: { kind: 'open', targetSurfaceId: 'drawer', parameters: [] },
        }],
        graph: actionGraph('dialog-action'),
      },
      drawer: {
        id: 'drawer',
        name: 'Drawer',
        kind: 'drawer',
        presentation: {
          kind: 'drawer',
          title: 'Drawer',
          placement: 'right',
          size: { desktop: { value: 40, unit: '%' } },
          mask: true,
          close: { escape: true, mask: true, button: true },
        },
        parameters: [],
        outputs: [],
        interactions: [],
        graph: actionGraph('drawer-action'),
      },
    },
    datasetOrder: [],
    datasetsById: {},
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: structuredClone(registry.lock),
    settings: {},
  }
  return {
    registry: createRegistryContractSnapshot(registry),
    snapshot: createProjectSnapshot(document, editVersion),
  }
}
