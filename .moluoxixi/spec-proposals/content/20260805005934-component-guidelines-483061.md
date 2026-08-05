# Component Guidelines

> How components are built in this project.

---

## Overview

Vue components use typed Composition API boundaries. Components that own async browser resources must also own cancellation state and deterministic cleanup for every success, failure, replacement, and unmount path.

## Scenario: Browser-Compiled Vue SFC Previews

### 1. Scope / Trigger

Use this contract when a documentation or developer-tool component compiles a Vue SFC string in the browser. It prevents unrestricted module loading, stale async results, and leaked style nodes during long-running preview sessions.

### 2. Signatures

```ts
interface LocalSfcCompileOptions {
  id: string
  onError?: (error: unknown) => void
}

interface LocalSfcCompileResult {
  component: Component
  dispose: () => void
}

function compileLocalSfc(
  source: string,
  options: LocalSfcCompileOptions,
): Promise<LocalSfcCompileResult>
```

The compiler is a resource factory. The Vue host component owns `runId`, visible state, and the active `dispose` handle.

### 3. Contracts

- Each compile uses a unique versioned virtual `.vue` entry path derived from the stable preview id.
- `getFile` accepts only that exact entry path. Relative files, absolute files, package subpaths, assets, and preprocessors are rejected unless explicitly added to the contract.
- `moduleCache` is a fresh null-prototype object per compile. Its keys are derived from one exact module allowlist.
- CSS side-effect imports map to empty runtime modules only when the host already imports those styles.
- Every style inserted by one compile belongs to its returned `dispose`; `dispose` is idempotent.
- Compile failure removes partial styles before rethrowing.
- The host disposes the previous result before a rerun. A stale successful result is disposed immediately and never replaces newer state.
- Unmount increments or invalidates the current run before disposing the active result, so a pending result is disposed when it resolves.
- Loader and descendant runtime errors are rendered in an accessible `role="alert"` state. They are not console-only diagnostics.

### 4. Validation & Error Matrix

| Input or event | Required behavior |
| --- | --- |
| Allowed bare module | Resolve from the fresh module cache |
| Unknown bare module or package subpath | Reject with the requested module/path in the diagnostic |
| File request other than the current virtual entry | Reject without returning source |
| Style inserted, then compilation rejects | Remove the partial style and rethrow |
| Older compile resolves after a newer run starts | Dispose the older result; keep the newer UI state |
| Component unmounts while compile is pending | Mark the run stale; dispose the result when it resolves |
| Loader calls `log('error', ...)` | Forward to the current run's visible error callback |
| Descendant setup/render/lifecycle throws | Capture at the preview host and show the diagnostic |

### 5. Good/Base/Bad Cases

- Good: a demo imports Vue, Element Plus, and the configured local component package, then reruns repeatedly while the style count remains bounded.
- Base: a template-only SFC compiles with no injected style and returns an idempotent no-op disposer.
- Bad: an SFC imports `./helper.vue` or an unlisted package; the request must fail instead of receiving the entry source.

### 6. Tests Required

- Assert the virtual entry changes between compiles and `getFile` rejects every other path.
- Assert module cache keys exactly match the allowlist, the cache prototype is null, and each compile gets a distinct cache.
- Insert a style before success and before failure; assert idempotent success disposal and automatic failure cleanup.
- Resolve concurrent runs out of order; assert the stale disposer runs once and stale component/error/loading state never wins.
- Unmount with a pending compile; resolve it and assert its disposer runs once.
- Mount a compiled child that throws during a lifecycle hook; assert the host renders the error alert.
- Run browser coverage for compile failure, recovery, reset, navigation cleanup, and mobile overflow.

### 7. Wrong vs Correct

#### Wrong

```ts
const component = await loadModule('/demo.vue', {
  moduleCache: sharedCache,
  getFile: async () => ({ getContentData: () => source, type: '.vue' }),
  addStyle: css => document.head.append(createStyle(css)),
})
preview.value = component
```

This returns the entry source for any file, shares mutable module state, leaks styles on failure, and allows stale promises to overwrite newer previews.

#### Correct

```ts
const seq = ++runId
activeDispose?.()
activeDispose = null

const result = await compileLocalSfc(source, { id, onError })
if (seq !== runId) {
  result.dispose()
  return
}

activeDispose = result.dispose
preview.value = result.component
```

The shared compiler enforces the file/module boundary and resource cleanup; the host enforces lifecycle ordering.

## Component Structure

- Keep page-specific state in the page component and shared risky boundaries in focused utilities.
- Prefer `shallowRef<Component | null>` for dynamically compiled components.
- Invalidate pending async work during `onUnmounted` before releasing the active resource.

## Props Conventions

- Use typed `defineProps` declarations.
- Keep stable domain identifiers separate from DOM-only identifiers such as `useId()`.

## Styling Patterns

- Use scoped styles for page-only surfaces and shared theme styles for repeated documentation controls.
- Resource-producing runtime styles must carry explicit ownership and cleanup.

## Accessibility

- Icon-only buttons require an accessible name and visible hover tooltip/title.
- Async status uses `role="status"`; compile/runtime failures use `role="alert"`.
- Controls remain keyboard reachable and text must not overflow at supported mobile widths.

## Common Mistakes

- Treating a loader module cache as a global performance cache. Preview isolation requires a fresh cache.
- Cleaning styles only after successful compilation. Partial styles may already exist when compilation rejects.
- Using a stable DOM id as a stable demo/session id. Generate the demo id from stable content or route metadata instead.
- Disposing only the last successful result on unmount without invalidating a pending compile.
