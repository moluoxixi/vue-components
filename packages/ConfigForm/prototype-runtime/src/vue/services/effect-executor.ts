import type { PrototypeSessionEffect, PrototypeTransition } from '../../session/types'
import type {
  PrototypeVueEffectExecutor,
  PrototypeVueEffectExecutorOptions,
} from '../types'

function assertNever(effect: never): never {
  throw new Error(`Unsupported Prototype session effect: ${JSON.stringify(effect)}.`)
}

export function createPrototypeVueEffectExecutor(
  options: PrototypeVueEffectExecutorOptions,
): PrototypeVueEffectExecutor {
  let executed = new WeakSet<object>()
  let executionGeneration = 0

  function apply(
    effect: PrototypeSessionEffect,
    transition: PrototypeTransition,
    generation: number,
  ): void {
    switch (effect.type) {
      case 'instance.mount': {
        const instance = transition.session.instancesById[effect.instanceId]
        if (!instance || instance.surfaceId !== effect.surfaceId) {
          throw new Error(
            `Prototype mount effect does not match the transition session: ${effect.instanceId}.`,
          )
        }
        options.registry.mount(instance)
        break
      }
      case 'instance.dispose':
        options.registry.dispose(effect.instanceId)
        break
      case 'instance.values.replace':
        options.registry.replaceValues(effect.instanceId, {
          values: effect.values,
          changedAddresses: effect.changedAddresses,
        })
        break
      case 'instance.projection.replace':
        options.registry.replaceProjection(effect.instanceId, effect.projection)
        break
      case 'focus.restore': {
        const focus = () => {
          if (generation !== executionGeneration)
            return
          if (transition.session.instancesById[effect.instanceId]
            && options.registry.has(effect.instanceId)) {
            options.registry.focus(effect.instanceId, effect.address)
          }
        }
        if (options.scheduleFocus)
          options.scheduleFocus(focus)
        else
          focus()
        break
      }
      default:
        assertNever(effect)
    }
    options.onEffect?.(effect)
  }

  return {
    execute: (transition) => {
      if (executed.has(transition))
        return
      executed.add(transition)
      const generation = ++executionGeneration
      transition.effects.forEach(effect => apply(effect, transition, generation))
    },
    reset: () => {
      executed = new WeakSet<object>()
      executionGeneration += 1
    },
  }
}
