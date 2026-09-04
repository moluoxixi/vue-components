# Hooks Quality Contracts

## 1. Scope / Trigger

Apply this contract when changing `@moluoxixi/hooks`, its query keys, pagination/watch behavior, mutations, public exports, or package publishing. The package owns Vue Query-backed UI state; callers own transport functions and product protocols.

## 2. Signatures

```ts
useRequestOptions(options): UseRequestOptionsReturn
useRequestTable(options): UseRequestTableReturn
useListPage(options): UseListPageReturn
useDetailPage(options): UseDetailPageReturn
useFormSubmit(options): UseFormSubmitReturn
useBatchOperate(options): UseBatchOperateReturn

normalizeQueryKey(key: QueryKeyBase): readonly unknown[]
invalidateQueryKeys(client: QueryClient, keys: QueryKeyBase[]): Promise<void>
```

The root runtime surface is exactly these eight functions. There are no public subpath exports.

## 3. Contracts

- Every hook runs inside a Vue component scope with a host-installed `VueQueryPlugin`. The package reuses the injected `QueryClient` and never creates a hidden client.
- Six feature implementations own refs, computed values, watchers, or Vue Query state and live below their feature `state/` directory.
- Deterministic helpers live in `utils/`. `useRequestTable` pagination normalization is feature-private and is not re-exported from the package root.
- `useRequestTable` reuses caller-provided page refs. Getter inputs project into internal writable refs. Params are watched deeply and reset the page to `1` unless `resetPageOnParamsChange` is false.
- Pagination normalization uses the fallback for `undefined`, `NaN`, and infinities; finite values are truncated and clamped to at least `1`.
- Form and batch mutations await every query invalidation before clearing batch selection or invoking `onSuccess`. Rejections propagate to the caller.
- The package exports only `.`. Its source condition points to `index.ts`, so `files` includes `dist`, `index.ts`, and `src`.

## 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| RequestTable page is `NaN`/infinite/undefined | Use the operation's fallback |
| RequestTable page is zero or negative | Clamp to `1` |
| RequestTable page is fractional | Truncate, then clamp |
| Deep params change | Reset current page to `1` unless disabled |
| Detail id is null/undefined | Disable query; defensive query call rejects |
| Batch selection is empty | Reject without calling `operate` |
| Mutation fails | Preserve error/rejection; batch selection remains |
| Invalidation is pending | Do not call `onSuccess` or clear batch selection yet |
| Public runtime symbol is added/removed | Entry-boundary test fails; treat as API change |
| Packed source entry is missing | Publish verification fails |

## 5. Good / Base / Bad Cases

- Good: a caller passes `currentPage` as a Ref and both sides observe the same state.
- Good: a deep filter mutation resets pagination before the next query key is evaluated.
- Base: no invalidation keys runs the success callback immediately after the mutation succeeds.
- Bad: creating a QueryClient inside a hook splits cache ownership from the host application.
- Bad: calling `onSuccess` before invalidation settles lets consumers read stale cache state.
- Bad: exporting a feature-private normalization helper expands the package API during an internal refactor.

## 6. Tests Required

- Entry tests assert the exact eight runtime exports and no subpath contract is introduced accidentally.
- RequestTable tests cover external Ref identity, getter projection, deep params watch, reset opt-out, fallback/clamp/truncate, query key, and page-size reset.
- Form and batch tests use deferred invalidation to prove callback/selection ordering.
- Hook tests run through a mounted component with `VueQueryPlugin`; calling composables outside setup is not valid evidence.
- Package tests, coverage, typecheck, and build run after state/utils changes.
- Components consumer tests/typecheck/build and packed Node/browser smoke run after root, type, declaration, or source-file changes.

## 7. Wrong vs Correct

```ts
// Wrong: a hidden client gives the hook a separate cache.
const queryClient = new QueryClient()

// Correct: use the host application's injected cache.
const queryClient = useQueryClient()
```

```ts
// Wrong: callback runs while cache invalidation is still pending.
invalidateQueryKeys(queryClient, keys)
options.onSuccess?.(result, payload)

// Correct: invalidation is part of successful mutation completion.
await invalidateQueryKeys(queryClient, keys)
options.onSuccess?.(result, payload)
```
