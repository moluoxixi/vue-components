# Request Cached Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TanStack Query backed request hooks and request-aware Element Plus/table components with stable `params`-based caching.

**Architecture:** Request/cache state lives in `@moluoxixi/hooks`; `@moluoxixi/components` consumes those hooks and adapts them to Element Plus and existing table components. Option components use `query(params) => Promise<Option[]>`; table components use `query({ ...params, currentPage, pageSize }) => Promise<{ data, total }>`.

**Tech Stack:** Vue 3.5 `defineModel`, TanStack Vue Query v5, Element Plus, Vitest, Vue Test Utils, Vite library builds.

---

## Task 1: Add Request Hook Types

**Files:**
- Modify: `packages/hooks/src/types/common.ts`
- Create: `packages/hooks/src/types/request-options.ts`
- Create: `packages/hooks/src/types/request-table.ts`
- Modify: `packages/hooks/src/types/index.ts`

- [ ] **Step 1: Add shared table request types**

Add to `packages/hooks/src/types/common.ts`:

```ts
export interface RequestTablePageParams {
  currentPage: number
  pageSize: number
}

export interface RequestTableResult<TItem> {
  data: TItem[]
  total: number
}

export type RequestTableQuery<
  TItem,
  TParams extends Record<string, unknown> = Record<string, unknown>,
> = (params: TParams & RequestTablePageParams) => Promise<RequestTableResult<TItem>>
```

- [ ] **Step 2: Add option hook type file**

Create `packages/hooks/src/types/request-options.ts`:

```ts
import type { UseQueryReturnType } from '@tanstack/vue-query'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { QueryKeyBase } from './common'

export interface UseRequestOptionsOptions<
  TOption,
  TParams extends Record<string, unknown> = Record<string, unknown>,
> {
  queryKey: QueryKeyBase
  query: (params: TParams) => Promise<TOption[]>
  params?: MaybeRefOrGetter<TParams>
  enabled?: MaybeRefOrGetter<boolean>
  staleTime?: number
}

export interface UseRequestOptionsReturn<TOption> {
  options: ComputedRef<TOption[]>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  isError: Ref<boolean>
  error: Ref<Error | null>
  refetch: () => Promise<unknown>
  query: UseQueryReturnType<TOption[], Error>
}
```

- [ ] **Step 3: Add table hook type file**

Create `packages/hooks/src/types/request-table.ts`:

```ts
import type { UseQueryReturnType } from '@tanstack/vue-query'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { QueryKeyBase, RequestTableQuery, RequestTableResult } from './common'

export interface UseRequestTableOptions<
  TItem,
  TParams extends Record<string, unknown> = Record<string, unknown>,
> {
  queryKey: QueryKeyBase
  query: RequestTableQuery<TItem, TParams>
  params?: MaybeRefOrGetter<TParams>
  currentPage?: MaybeRefOrGetter<number>
  pageSize?: MaybeRefOrGetter<number>
  defaultCurrentPage?: number
  defaultPageSize?: number
  resetPageOnParamsChange?: boolean
  enabled?: MaybeRefOrGetter<boolean>
  staleTime?: number
}

export interface UseRequestTableReturn<TItem> {
  data: ComputedRef<TItem[]>
  total: ComputedRef<number>
  currentPage: Ref<number>
  pageSize: Ref<number>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  isError: Ref<boolean>
  error: Ref<Error | null>
  setCurrentPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  refetch: () => Promise<unknown>
  query: UseQueryReturnType<RequestTableResult<TItem>, Error>
}
```

- [ ] **Step 4: Export new types**

Modify `packages/hooks/src/types/index.ts` to export:

```ts
export type * from './request-options'
export type * from './request-table'
```

- [ ] **Step 5: Run typecheck for expected missing implementations**

Run: `pnpm --filter @moluoxixi/hooks typecheck`

Expected: `PASS` because only type exports were added.

## Task 2: Implement `useRequestOptions` With TDD

**Files:**
- Create: `packages/hooks/__test__/useRequestOptions.test.ts`
- Create: `packages/hooks/src/composables/useRequestOptions/useRequestOptions.ts`
- Create: `packages/hooks/src/composables/useRequestOptions/index.ts`
- Modify: `packages/hooks/src/composables/index.ts`
- Modify: `packages/hooks/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/hooks/__test__/useRequestOptions.test.ts` with tests for:

```ts
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useRequestOptions } from '../src/composables'
import { withSetup } from './test-utils'

describe('useRequestOptions', () => {
  it('uses params as part of the query key and returns option arrays', async () => {
    const params = ref({ keyword: 'a' })
    const query = vi.fn(async (input: { keyword: string }) => [
      { label: input.keyword.toUpperCase(), value: input.keyword },
    ])

    const { result, queryClient, unmount } = withSetup(() => useRequestOptions({
      queryKey: 'request-select',
      query,
      params,
    }))

    await vi.waitFor(() => expect(result.options.value).toEqual([{ label: 'A', value: 'a' }]))
    expect(queryClient.getQueryData(['request-select', { keyword: 'a' }])).toEqual([{ label: 'A', value: 'a' }])

    params.value = { keyword: 'b' }
    await vi.waitFor(() => expect(result.options.value).toEqual([{ label: 'B', value: 'b' }]))
    expect(query).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData(['request-select', { keyword: 'b' }])).toEqual([{ label: 'B', value: 'b' }])

    unmount()
  })

  it('supports enabled=false and manual refetch', async () => {
    const query = vi.fn(async () => [{ label: 'Role', value: 'role' }])

    const { result, unmount } = withSetup(() => useRequestOptions({
      queryKey: 'disabled-options',
      query,
      params: {},
      enabled: false,
    }))

    expect(result.options.value).toEqual([])
    expect(query).not.toHaveBeenCalled()

    await result.refetch()
    await vi.waitFor(() => expect(result.options.value).toEqual([{ label: 'Role', value: 'role' }]))
    expect(query).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('exposes errors without swallowing request failures', async () => {
    const failure = new Error('load failed')
    const enabled = computed(() => true)
    const query = vi.fn(async () => {
      throw failure
    })

    const { result, unmount } = withSetup(() => useRequestOptions({
      queryKey: 'broken-options',
      query,
      params: {},
      enabled,
    }))

    await vi.waitFor(() => expect(result.isError.value).toBe(true))
    expect(result.error.value).toBe(failure)
    expect(result.options.value).toEqual([])

    unmount()
  })
})
```

- [ ] **Step 2: Run test and verify RED**

Run: `pnpm --filter @moluoxixi/hooks test -- --run useRequestOptions`

Expected: `FAIL` because `useRequestOptions` is not exported.

- [ ] **Step 3: Implement minimal hook**

Create `packages/hooks/src/composables/useRequestOptions/useRequestOptions.ts`:

```ts
import type { UseRequestOptionsOptions, UseRequestOptionsReturn } from '../../types'
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'
import { normalizeQueryKey } from '../../utils'

export function useRequestOptions<
  TOption,
  TParams extends Record<string, unknown> = Record<string, unknown>,
>(options: UseRequestOptionsOptions<TOption, TParams>): UseRequestOptionsReturn<TOption> {
  const params = computed<TParams>(() => toValue(options.params) ?? ({} as TParams))
  const queryKey = computed(() => [
    ...normalizeQueryKey(options.queryKey),
    params.value,
  ])

  const query = useQuery<TOption[], Error>({
    queryKey,
    queryFn: () => options.query(params.value),
    enabled: computed(() => toValue(options.enabled ?? true)),
    staleTime: options.staleTime,
    placeholderData: previous => previous,
  })

  return {
    options: computed(() => query.data.value ?? []),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
    query,
  }
}
```

Create `packages/hooks/src/composables/useRequestOptions/index.ts`:

```ts
export { useRequestOptions } from './useRequestOptions'
```

Modify `packages/hooks/src/composables/index.ts`:

```ts
export { useRequestOptions } from './useRequestOptions'
```

Modify `packages/hooks/index.ts` to export `useRequestOptions`.

- [ ] **Step 4: Run test and verify GREEN**

Run: `pnpm --filter @moluoxixi/hooks test -- --run useRequestOptions`

Expected: `PASS`.

## Task 3: Implement `useRequestTable` With TDD

**Files:**
- Create: `packages/hooks/__test__/useRequestTable.test.ts`
- Create: `packages/hooks/src/composables/useRequestTable/useRequestTable.ts`
- Create: `packages/hooks/src/composables/useRequestTable/index.ts`
- Modify: `packages/hooks/src/composables/index.ts`
- Modify: `packages/hooks/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/hooks/__test__/useRequestTable.test.ts` with tests for:

```ts
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useRequestTable } from '../src/composables'
import { withSetup } from './test-utils'

interface Row {
  id: number
  name: string
}

describe('useRequestTable', () => {
  it('uses params and pagination as the query key', async () => {
    const params = ref({ keyword: 'warehouse' })
    const query = vi.fn(async (input: { keyword: string, currentPage: number, pageSize: number }) => ({
      data: [{ id: input.currentPage, name: `${input.keyword}-${input.pageSize}` }],
      total: 23,
    }))

    const { result, queryClient, unmount } = withSetup(() => useRequestTable<Row, { keyword: string }>({
      queryKey: 'request-table',
      query,
      params,
      defaultCurrentPage: 2,
      defaultPageSize: 5,
    }))

    await vi.waitFor(() => expect(result.data.value).toEqual([{ id: 2, name: 'warehouse-5' }]))
    expect(result.total.value).toBe(23)
    expect(queryClient.getQueryData(['request-table', { keyword: 'warehouse' }, { currentPage: 2, pageSize: 5 }])).toEqual({
      data: [{ id: 2, name: 'warehouse-5' }],
      total: 23,
    })

    result.setCurrentPage(3)
    await vi.waitFor(() => expect(result.data.value).toEqual([{ id: 3, name: 'warehouse-5' }]))
    expect(query).toHaveBeenLastCalledWith({ keyword: 'warehouse', currentPage: 3, pageSize: 5 })

    unmount()
  })

  it('resets current page when page size or params change', async () => {
    const params = ref({ status: 'active' })
    const query = vi.fn(async (input: { status: string, currentPage: number, pageSize: number }) => ({
      data: [{ id: input.currentPage, name: input.status }],
      total: 100,
    }))

    const { result, unmount } = withSetup(() => useRequestTable<Row, { status: string }>({
      queryKey: 'reset-table',
      query,
      params,
      defaultCurrentPage: 4,
      defaultPageSize: 20,
    }))

    await vi.waitFor(() => expect(result.currentPage.value).toBe(4))
    result.setPageSize(50)
    expect(result.currentPage.value).toBe(1)
    expect(result.pageSize.value).toBe(50)

    result.setCurrentPage(3)
    params.value = { status: 'disabled' }
    await vi.waitFor(() => expect(result.currentPage.value).toBe(1))
    await vi.waitFor(() => expect(query).toHaveBeenLastCalledWith({ status: 'disabled', currentPage: 1, pageSize: 50 }))

    unmount()
  })

  it('can keep current page when params change', async () => {
    const params = ref({ status: 'active' })
    const query = vi.fn(async (input: { status: string, currentPage: number, pageSize: number }) => ({
      data: [{ id: input.currentPage, name: input.status }],
      total: 100,
    }))

    const { result, unmount } = withSetup(() => useRequestTable<Row, { status: string }>({
      queryKey: 'keep-page-table',
      query,
      params,
      defaultCurrentPage: 4,
      defaultPageSize: 20,
      resetPageOnParamsChange: false,
    }))

    await vi.waitFor(() => expect(result.currentPage.value).toBe(4))
    params.value = { status: 'disabled' }
    await vi.waitFor(() => expect(query).toHaveBeenLastCalledWith({ status: 'disabled', currentPage: 4, pageSize: 20 }))

    unmount()
  })
})
```

- [ ] **Step 2: Run test and verify RED**

Run: `pnpm --filter @moluoxixi/hooks test -- --run useRequestTable`

Expected: `FAIL` because `useRequestTable` is not exported.

- [ ] **Step 3: Implement minimal hook**

Implement `useRequestTable` with local writable refs initialized from controlled values, a `watch` that syncs controlled input changes, a `watch` that resets page on params changes when enabled, and a `useQuery` key of `normalizeQueryKey(queryKey) + params + pagination`.

- [ ] **Step 4: Run test and verify GREEN**

Run: `pnpm --filter @moluoxixi/hooks test -- --run useRequestTable`

Expected: `PASS`.

## Task 4: Add Request Option Components

**Files:**
- Create: `packages/components/src/request/types.ts`
- Create: `packages/components/src/RequestSelectV2/index.ts`
- Create: `packages/components/src/RequestSelectV2/src/index.vue`
- Create: `packages/components/src/RequestCascader/index.ts`
- Create: `packages/components/src/RequestCascader/src/index.vue`
- Create: `packages/components/src/RequestTreeSelect/index.ts`
- Create: `packages/components/src/RequestTreeSelect/src/index.vue`
- Create: `packages/components/src/RequestOptions/RequestOptions.test.ts`
- Modify: `packages/components/src/index.ts`
- Modify: `packages/components/package.json`
- Modify: `packages/components/vite.config.ts`

- [ ] **Step 1: Write failing component tests**

Create tests that mount each component with Element Plus stubs and a `VueQueryPlugin` test client. Verify:

- returned options bind to `ElSelectV2.options` and `ElCascader.options`;
- returned options bind to `ElTreeSelect.data`;
- `v-model` writes back through `defineModel`;
- `error` event fires when query rejects;
- exposed `refetch` calls query again.

- [ ] **Step 2: Run test and verify RED**

Run: `pnpm --filter @moluoxixi/components test -- --run RequestOptions`

Expected: `FAIL` because request components do not exist.

- [ ] **Step 3: Implement components**

Use `useRequestOptions` from `@moluoxixi/hooks`, `defineModel` for `modelValue`, `defineEmits` for `loaded/error`, and `useAttrs()` to pass remaining attrs to the Element Plus component.

- [ ] **Step 4: Update package dependencies**

Add `@moluoxixi/hooks` to `packages/components/package.json` dependencies and externalize `@moluoxixi/hooks` in `packages/components/vite.config.ts`.

- [ ] **Step 5: Run component request tests**

Run: `pnpm --filter @moluoxixi/components test -- --run RequestOptions`

Expected: `PASS`.

## Task 5: Extend `ConfigTable` With Request and Pagination

**Files:**
- Modify: `packages/components/src/ConfigTable/src/types/index.ts`
- Modify: `packages/components/src/ConfigTable/src/index.vue`
- Modify: `packages/components/src/ConfigTable/ConfigTable.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:

- static `data` mode remains unchanged;
- `query` mode renders returned rows;
- default request mode renders an `ElPagination` stub;
- `pagination=false` hides pagination but still requests with `currentPage/pageSize`;
- `pageSize` change resets `currentPage`;
- `params` change resets `currentPage`.

- [ ] **Step 2: Run test and verify RED**

Run: `pnpm --filter @moluoxixi/components test -- --run ConfigTable`

Expected: `FAIL` on missing request/pagination behavior.

- [ ] **Step 3: Implement request mode**

Add typed props for `query`, `params`, `cacheKey`, `enabled`, `staleTime`, `pagination`, and `resetPageOnParamsChange`. Use `defineModel<number>('currentPage', { default: 1 })` and `defineModel<number>('pageSize', { default: 10 })`. When `query` exists, use `useRequestTable`; otherwise use `props.data`.

- [ ] **Step 4: Implement pagination UI**

Render `ElPagination` when `shouldShowPagination` is true. Bind `current-page`, `page-size`, `total`, and emit/write through model setters. Keep `empty` slot priority over default empty text.

- [ ] **Step 5: Run ConfigTable tests**

Run: `pnpm --filter @moluoxixi/components test -- --run ConfigTable`

Expected: `PASS`.

## Task 6: Extend `PopoverTableSelect` With Request and Pagination

**Files:**
- Modify: `packages/components/src/PopoverTableSelect/src/types/props.ts`
- Modify: `packages/components/src/PopoverTableSelect/src/types/emits.ts`
- Modify: `packages/components/src/PopoverTableSelect/src/index.vue`
- Modify: `packages/components/src/PopoverTableSelect/PopoverTableSelect.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:

- existing input/select behavior remains unchanged;
- `query` mode passes returned rows to base table;
- default request mode shows pagination;
- `pagination=false` hides pagination and does not reinterpret scroll bottom as page increment;
- `pageChange`, `loaded`, and `error` events fire correctly.

- [ ] **Step 2: Run test and verify RED**

Run: `pnpm --filter @moluoxixi/components test -- --run PopoverTableSelect`

Expected: `FAIL` on missing request/pagination behavior.

- [ ] **Step 3: Implement request table plumbing**

Use `useRequestTable`, `defineModel<number>('currentPage', { default: 1 })`, and `defineModel<number>('pageSize', { default: 10 })`. Pass request rows and loading into `PopoverTableSelectBase`; render pagination below the base table when enabled.

- [ ] **Step 4: Preserve old load-more behavior**

Keep `enableLoadMore/loadMore` for non-query or external incremental loading. Do not increment request page from `scrollBoundary`.

- [ ] **Step 5: Run PopoverTableSelect tests**

Run: `pnpm --filter @moluoxixi/components test -- --run PopoverTableSelect`

Expected: `PASS`.

## Task 7: Update Exports and Documentation

**Files:**
- Modify: `packages/hooks/index.ts`
- Modify: `packages/hooks/src/composables/index.ts`
- Modify: `packages/hooks/src/types/index.ts`
- Modify: `packages/components/src/index.ts`
- Modify: `packages/components/README.md`
- Create: `docs/out-components/RequestSelectV2.md`
- Create: `docs/out-components/RequestCascader.md`
- Create: `docs/out-components/RequestTreeSelect.md`
- Create: `docs/out-components/ConfigTable.md`
- Modify: `docs/out-components/PopoverTableSelect.md`
- Modify: `docs/out-components/index.md`
- Modify: `docs/map.md`

- [ ] **Step 1: Export new public APIs**

Export hooks/types from `@moluoxixi/hooks` and components/types from `@moluoxixi/components`.

- [ ] **Step 2: Update README**

Document that request components require host `VueQueryPlugin` and `QueryClient`.

- [ ] **Step 3: Update out-components docs**

Write provider docs for the three new request components and update existing table docs with request and pagination props.

- [ ] **Step 4: Update indexes**

Add new components to `docs/out-components/index.md` and `docs/map.md`.

## Task 8: Focused Verification and Review

**Files:** No production edits expected.

- [ ] **Step 1: Run hooks tests**

Run: `pnpm --filter @moluoxixi/hooks test`

Expected: `PASS`.

- [ ] **Step 2: Run components tests**

Run: `pnpm --filter @moluoxixi/components test`

Expected: `PASS`.

- [ ] **Step 3: Run hooks typecheck**

Run: `pnpm --filter @moluoxixi/hooks typecheck`

Expected: `PASS`.

- [ ] **Step 4: Run components typecheck**

Run: `pnpm --filter @moluoxixi/components typecheck`

Expected: `PASS`.

- [ ] **Step 5: Run independent frontend code review**

Dispatch an independent frontend reviewer with the final diff. Required result: `PASS`; fix any `FAIL` or `MISSING` findings and re-run focused verification.

- [ ] **Step 6: Final status check**

Run: `git status --short --branch`

Expected: only intended feature files are modified or untracked.
