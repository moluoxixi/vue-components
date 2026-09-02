import type { ProjectPage } from '@moluoxixi/config-form-model'
import type {
  BuiltInSeedDefinition,
  ProjectTemplateSeed,
  TemplateCatalogProvider,
} from '../types'
import { createBlankGraph, createProfileGraph } from './create-seed-graph'

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== 'object' || Object.isFrozen(value))
    return value
  Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}

function createSeed(definition: BuiltInSeedDefinition): ProjectTemplateSeed {
  const page: ProjectPage = {
    id: 'template-page',
    name: definition.category === 'blank' ? 'Blank form' : 'Profile form',
    route: '/',
    graph: definition.category === 'blank' ? createBlankGraph() : createProfileGraph(definition.adapter),
    flows: [],
  }
  return {
    manifest: {
      id: definition.id,
      version: 1,
      displayName: definition.displayName,
      description: definition.description,
      adapter: definition.adapter,
      category: definition.category,
      order: definition.order,
      tags: [...definition.tags],
      registry: {
        adapter: definition.adapter,
        components: Object.values(page.graph.nodesById).map(node => ({ key: node.component })),
      },
      preview: { preferredViewport: 'desktop', pageId: page.id },
    },
    page,
  }
}

const BUILT_IN_TEMPLATE_SEEDS = deepFreeze([
  createSeed({
    adapter: 'element-plus',
    category: 'blank',
    description: 'An empty Element Plus form with responsive layout settings.',
    displayName: 'Element Plus blank form',
    id: 'element-blank',
    order: 10,
    tags: ['Element Plus', 'blank', 'empty'],
  }),
  createSeed({
    adapter: 'element-plus',
    category: 'starter',
    description: 'A responsive Element Plus profile form with name, role, and active fields.',
    displayName: 'Element Plus profile form',
    id: 'element-profile',
    order: 20,
    tags: ['Element Plus', 'profile', 'starter'],
  }),
  createSeed({
    adapter: 'antd-vue',
    category: 'blank',
    description: 'An empty Ant Design Vue form with responsive layout settings.',
    displayName: 'Ant Design Vue blank form',
    id: 'antd-blank',
    order: 30,
    tags: ['Ant Design Vue', 'blank', 'empty'],
  }),
  createSeed({
    adapter: 'antd-vue',
    category: 'starter',
    description: 'A responsive Ant Design Vue profile form with name, role, and active fields.',
    displayName: 'Ant Design Vue profile form',
    id: 'antd-profile',
    order: 40,
    tags: ['Ant Design Vue', 'profile', 'starter'],
  }),
] satisfies ProjectTemplateSeed[])

export function getBuiltInTemplateSeed(id: string): ProjectTemplateSeed | undefined {
  const seed = BUILT_IN_TEMPLATE_SEEDS.find(candidate => candidate.manifest.id === id)
  return seed ? structuredClone(seed) : undefined
}

export const builtInTemplateCatalogProvider: TemplateCatalogProvider = Object.freeze({
  id: 'built-in',
  async list() {
    return structuredClone(BUILT_IN_TEMPLATE_SEEDS)
  },
})
