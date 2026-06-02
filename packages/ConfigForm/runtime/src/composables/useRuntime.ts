import type { ComputedRef, InjectionKey } from 'vue'
import type { FormRuntime, FormRuntimeOptions } from '@/runtime'
import { computed, inject, provide } from 'vue'
import { createFormRuntime } from '@/runtime'

const runtimeKey: InjectionKey<ComputedRef<FormRuntime>> = Symbol('config-form-runtime')
const defaultRuntime = createFormRuntime()

/** 将可选运行时配置转换成可直接使用的 FormRuntime 实例。 */
export function normalizeFormRuntime(input?: FormRuntimeOptions): FormRuntime {
  if (!input)
    return defaultRuntime
  return createFormRuntime(input)
}

/** 向下游字段渲染组件提供响应式 FormRuntime。 */
export function provideRuntime(runtime: ComputedRef<FormRuntime>) {
  provide(runtimeKey, runtime)
}

/** 读取最近的 FormRuntime；脱离 ConfigForm 使用时回到默认运行时。 */
export function useRuntime(): ComputedRef<FormRuntime> {
  return inject(runtimeKey, computed(() => defaultRuntime))
}
