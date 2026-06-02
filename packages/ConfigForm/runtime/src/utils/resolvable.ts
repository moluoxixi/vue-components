export type ResolvableValue<TValue, TContext> = TValue | ((context: TContext) => TValue)

/**
 * 解析可直接声明或基于上下文派生的配置值。
 *
 * null/undefined 只表示未声明；派生函数的异常必须按原语义抛给调用方。
 */
export function resolveValue<TValue, TContext>(
  value: ResolvableValue<TValue, TContext> | null | undefined,
  context: TContext,
  defaultValue: TValue,
): TValue {
  if (value == null)
    return defaultValue
  if (typeof value === 'function')
    return (value as (context: TContext) => TValue)(context)
  return value
}
