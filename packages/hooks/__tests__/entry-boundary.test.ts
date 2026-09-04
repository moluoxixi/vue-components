import { describe, expect, it } from 'vitest'
import * as hooks from '../index'

describe('package entry', () => {
  it('keeps the exact runtime surface', () => {
    expect(Object.keys(hooks).sort()).toEqual([
      'invalidateQueryKeys',
      'normalizeQueryKey',
      'useBatchOperate',
      'useDetailPage',
      'useFormSubmit',
      'useListPage',
      'useRequestOptions',
      'useRequestTable',
    ])
  })
})
