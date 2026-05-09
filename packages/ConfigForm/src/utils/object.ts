import { isVNode } from 'vue'

/** ConfigForm 内部可安全当作普通配置对象读取的记录类型。 */
export type PlainRecord = Record<string, unknown>

/** 判断未知值是否是普通对象；数组、null 和 class 实例不会通过。 */
export function isPlainRecord(value: unknown): value is PlainRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false

  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** 读取可合并的普通对象选项；非法值直接抛错暴露配置来源。 */
export function readPlainRecord(value: unknown, optionName: string): PlainRecord {
  if (isPlainRecord(value))
    return value

  throw new TypeError(`${optionName} must be a plain object`)
}

/** 浅复制配置记录，并对指定子记录追加一层浅复制；组件、VNode 和非普通对象保持原引用。 */
export function cloneRecordWithChildren<TRecord extends object>(
  source: TRecord,
  childKeys: readonly string[] = [],
): TRecord {
  const clone = { ...source } as PlainRecord
  const record = source as PlainRecord

  for (const key of childKeys) {
    const value = record[key]
    if (isPlainRecord(value))
      clone[key] = { ...value }
  }

  return clone as TRecord
}

/** 深合并普通对象；右侧对象优先，数组、VNode 和组件对象保持整体替换。 */
export function mergeRecords(...sources: Array<object | undefined>): PlainRecord {
  const result: PlainRecord = {}
  for (const source of sources) {
    if (source === undefined)
      continue

    const record = readPlainRecord(source, 'mergeRecords source')
    for (const [key, value] of Object.entries(record)) {
      const previous = result[key]
      if (canMergeValue(key, previous, value)) {
        result[key] = mergeRecords(previous, value as PlainRecord)
        continue
      }
      result[key] = value
    }
  }
  return result
}

/** 判断当前字段是否可以递归合并；组件入口必须保持引用整体替换。 */
function canMergeValue(key: string, previous: unknown, value: unknown): previous is PlainRecord {
  return key !== 'component' && isMergeableRecord(previous) && isMergeableRecord(value)
}

/** 判断值是否可安全递归合并；VNode 和 Vue 组件对象作为完整值替换，不能按普通对象拆开。 */
function isMergeableRecord(value: unknown): value is PlainRecord {
  return isPlainRecord(value) && !isVNode(value) && !isVueComponentObject(value)
}

/** 判断普通对象是否具备 Vue 组件选项特征；命中时合并应直接替换整个组件对象。 */
function isVueComponentObject(value: PlainRecord): boolean {
  return typeof value.setup === 'function'
    || typeof value.render === 'function'
    || typeof value.template === 'string'
    || typeof value.__name === 'string'
    || typeof value.__file === 'string'
    || isPlainRecord(value.__vccOpts)
}
