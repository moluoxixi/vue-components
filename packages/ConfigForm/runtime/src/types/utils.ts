import type {
  Component,
  EmitFn,
  EmitsOptions,
  EmitsToProps,
  ShortEmitsToObject,
} from 'vue'
import type { ResolvedFormNode } from './contracts'

type ResolvedVueEmits<TEmits extends EmitsOptions | Record<string, any[]>>
  = ShortEmitsToObject<TEmits>

export type AdaptedVueFunctionalComponent<
  TProps extends object,
  TEmits extends EmitsOptions | Record<string, any[]>,
  TSlots extends Record<string, any>,
> = Component<TProps, any, any, any, any, TEmits, TSlots> & {
  new (): {
    $emit: EmitFn<ResolvedVueEmits<TEmits>>
    $props: Readonly<TProps & EmitsToProps<ResolvedVueEmits<TEmits>>>
    $slots: Readonly<TSlots>
  }
}

export type PlainRecord = Record<string, unknown>

export type ResolvableValue<TValue, TContext> = TValue | ((context: TContext) => TValue)

export interface ResolvedSlotNode {
  field: ResolvedFormNode
  key: string
}
