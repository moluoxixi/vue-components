import { isVNode } from 'vue'
import { ConfigFormError } from '@/errors'

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

  throw new ConfigFormError(
    'CONFIG_FORM_INVALID_PLAIN_OBJECT',
    `${optionName} must be a plain object`,
    { optionName },
  )
}

/** 浅复制配置记录，并对指定子记录做递归复制；组件、VNode 和非普通对象保持原引用。 */
export function cloneRecordWithChildren<TRecord extends object>(
  source: TRecord,
  childKeys: readonly string[] = [],
): TRecord {
  const clone = { ...source } as PlainRecord
  const record = source as PlainRecord
  const seen = new WeakSet<object>()

  for (const key of childKeys) {
    clone[key] = clonePlainData(record[key], seen, `cloneRecordWithChildren(${key})`)
  }

  return clone as TRecord
}

/** 递归复制纯数据对象与数组；组件、VNode 与实例对象保持原引用。 */
function clonePlainData<T>(value: T, seen: WeakSet<object>, path: string): T {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new ConfigFormError(
        'CONFIG_FORM_CIRCULAR_ARRAY_REFERENCE',
        `${path} contains a circular array reference`,
        { path },
      )
    }

    seen.add(value)
    const cloned = value.map((item, index) => clonePlainData(item, seen, `${path}[${index}]`)) as T
    seen.delete(value)
    return cloned
  }

  if (!isPlainRecord(value) || isVNode(value) || isVueComponentObject(value))
    return value

  if (seen.has(value)) {
    throw new ConfigFormError(
      'CONFIG_FORM_CIRCULAR_PLAIN_OBJECT_REFERENCE',
      `${path} contains a circular plain-object reference`,
      { path },
    )
  }

  seen.add(value)
  const cloned = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, clonePlainData(child, seen, `${path}.${key}`)]),
  ) as T
  seen.delete(value)
  return cloned
}

/** 深合并普通对象；右侧对象优先，数组、VNode 和组件对象保持整体替换。 */
export function mergeRecords(...sources: Array<object | undefined>): PlainRecord {
  return mergeRecordsInternal(new WeakSet<object>(), 'mergeRecords', ...sources)
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

function mergeRecordsInternal(
  seen: WeakSet<object>,
  path: string,
  ...sources: Array<object | undefined>
): PlainRecord {
  const result: PlainRecord = {}

  for (const source of sources) {
    if (source === undefined)
      continue

    const record = readPlainRecord(source, `${path} source`)
    if (seen.has(record)) {
      throw new ConfigFormError(
        'CONFIG_FORM_CIRCULAR_PLAIN_OBJECT_REFERENCE',
        `${path} contains a circular plain-object reference`,
        { path },
      )
    }

    seen.add(record)
    try {
      for (const [key, value] of Object.entries(record)) {
        const previous = result[key]
        if (canMergeValue(key, previous, value)) {
          result[key] = mergeRecordsInternal(seen, `${path}.${key}`, previous, value as PlainRecord)
          continue
        }
        result[key] = value
      }
    }
    finally {
      seen.delete(record)
    }
  }

  return result
}
