import type { Component, InjectionKey } from 'vue'
import { getCurrentInstance, inject, provide } from 'vue'

const RECURSIVE_FIELD_RENDERER_KEY: InjectionKey<Component> = Symbol('config-form-recursive-field-renderer')

export function provideRecursiveFieldRenderer(): void {
  const instance = getCurrentInstance()
  if (!instance)
    throw new Error('Recursive field renderer must be provided during component setup.')
  provide(RECURSIVE_FIELD_RENDERER_KEY, instance.type)
}

export function useRecursiveFieldRenderer(): Component | undefined {
  return inject(RECURSIVE_FIELD_RENDERER_KEY, undefined)
}
