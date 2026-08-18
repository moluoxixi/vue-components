import type {
  ElementPlusDocsPlaygroundAction,
  ElementPlusDocsPlaygroundAdapter,
  ElementPlusDocsPlaygroundConfig,
  ElementPlusDocsPlaygroundKind,
} from './types'
import { createElementPlusPlaygroundAdapter } from './element-plus-playground'
import { createElementPlusDocsCodeSandboxAdapter } from './external/codesandbox'
import { createElementPlusDocsStackBlitzAdapter } from './external/stackblitz'
import { createElementPlusDocsSessionPlaygroundAdapter } from './session'
import { elementPlusDocsPlaygroundKinds } from './types'

export interface ElementPlusDocsPlaygroundActionRuntime {
  assign: (url: string) => void
  asset: (path: string) => string
  isDark: () => boolean
  link: (path: string) => string
  location?: () => string
  open: (url: string) => void
}

export interface ElementPlusDocsPlaygroundRegistry {
  actions: readonly ElementPlusDocsPlaygroundAction[]
  get: (kind: ElementPlusDocsPlaygroundAction['kind']) => ElementPlusDocsPlaygroundAction | undefined
}

export type ElementPlusDocsPlaygroundConfigInput = Pick<
  ElementPlusDocsPlaygroundConfig,
  'elementPlus' | 'external' | 'path'
>

export function indexElementPlusDocsPlaygroundActions(
  actions: readonly ElementPlusDocsPlaygroundAction[],
): ReadonlyMap<ElementPlusDocsPlaygroundAction['kind'], ElementPlusDocsPlaygroundAction> {
  const actionByKind = new Map(actions.map(action => [action.kind, action]))
  if (actionByKind.size !== actions.length)
    throw new Error('Duplicate playground action kind.')
  return actionByKind
}

function createAdapters(
  config: ElementPlusDocsPlaygroundConfigInput,
  runtime: ElementPlusDocsPlaygroundActionRuntime,
): readonly ElementPlusDocsPlaygroundAdapter[] {
  const external = config.external
  const adapterByKind: Record<ElementPlusDocsPlaygroundKind, ElementPlusDocsPlaygroundAdapter | undefined> = {
    'codesandbox': external?.codeSandbox && external.project
      ? createElementPlusDocsCodeSandboxAdapter(
          external.codeSandbox,
          external.project,
        )
      : undefined,
    'stackblitz': external?.stackBlitz && external.project
      ? createElementPlusDocsStackBlitzAdapter(
          external.stackBlitz,
          external.project,
        )
      : undefined,
    'element-plus': config.elementPlus
      ? createElementPlusPlaygroundAdapter({
          ...config.elementPlus,
          baseUrl: runtime.location,
          isDark: runtime.isDark,
          open: runtime.open,
          resolvePath: runtime.asset,
        })
      : undefined,
    'lightweight': createElementPlusDocsSessionPlaygroundAdapter({
      path: config.path,
      link: runtime.link,
      assign: runtime.assign,
    }),
  }

  return elementPlusDocsPlaygroundKinds
    .map(kind => adapterByKind[kind])
    .filter((adapter): adapter is ElementPlusDocsPlaygroundAdapter => Boolean(adapter))
}

export function createElementPlusDocsPlaygroundRegistry(
  adapters: readonly (ElementPlusDocsPlaygroundAdapter | undefined)[],
): ElementPlusDocsPlaygroundRegistry {
  const actions = adapters
    .filter((adapter): adapter is ElementPlusDocsPlaygroundAdapter => Boolean(adapter))
    .map((adapter) => {
      const action = adapter.createAction()
      if (action.kind !== adapter.kind)
        throw new Error(`Playground adapter "${adapter.kind}" created action "${action.kind}".`)
      return action
    })
  const actionByKind = indexElementPlusDocsPlaygroundActions(actions)

  return {
    actions: Object.freeze(actions),
    get: kind => actionByKind.get(kind),
  }
}

export function createElementPlusDocsPlaygroundActions(
  config: ElementPlusDocsPlaygroundConfigInput,
  runtime: ElementPlusDocsPlaygroundActionRuntime,
): readonly ElementPlusDocsPlaygroundAction[] {
  return createElementPlusDocsPlaygroundRegistry(createAdapters(config, runtime)).actions
}
