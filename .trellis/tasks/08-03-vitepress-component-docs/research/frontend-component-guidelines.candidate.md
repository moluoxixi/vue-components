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

## Scenario: Preserve Generated Component Contracts During Structural Refactors

### 1. Scope / Trigger

Apply this contract when splitting a Vue component into composables, render helpers, or separate `props` / `emits` / `slots` / `expose` type files while API documentation is generated from TypeScript and JSDoc. A structural refactor must not silently change the published type entry or generated documentation.

### 2. Signatures

```ts
// types/props.ts
export interface ExampleProps {
  /** Existing public description must remain byte-for-byte equivalent. */
  value?: string
}

// types/index.ts
export type * from './props'
export type * from './emits'
export type * from './slots'
export type * from './expose'
```

```vue
<script setup lang="ts">
import type { ExampleEmits, ExampleExpose, ExampleProps } from './types'

const props = defineProps<ExampleProps>()
const emit = defineEmits<ExampleEmits>()

function refresh() {}
defineExpose<ExampleExpose>({ refresh })
</script>
```

### 3. Contracts

- Keep `defineProps`, `defineEmits`, `defineSlots`, and `defineExpose` calls inside the owning SFC. External files own type declarations, not compiler macro calls.
- Preserve one component-level type barrel and the existing package entry. Internal files are not new public subpaths unless explicitly designed as public API.
- Preserve the set and names of exported public types during a structure-only refactor.
- Preserve public JSDoc wording, defaults, required flags, payload/scope types, and exposed member names. Translation or copy editing is a separate documentation change with its own review.
- Prefer an imported expose interface with a local object literal, for example `defineExpose<ExampleExpose>({ refresh })`, so static extraction can identify the exact public members.
- Keep internal composables and render helpers acyclic. The SFC remains the composition and template boundary.

### 4. Validation & Error Matrix

| Change or condition | Required behavior |
| --- | --- |
| Public JSDoc changes during a structure-only split | Treat generated API description drift as a regression and restore the original text |
| Type declaration moves behind `types/index.ts` | Package typecheck, declaration build, and API extraction continue to resolve it |
| Compiler macro is moved to a `.ts` helper | Reject the refactor; return the macro call to the SFC |
| `defineExpose` uses a spread, dynamic key, or imported object value | Replace it with a statically enumerable local object literal when exact extraction is required |
| Public type export disappears or is renamed | Fail the public API parity check |
| Internal helper import graph becomes cyclic | Move shared types/helpers toward a lower-level module and remove the cycle |

### 5. Good/Base/Bad Cases

- Good: a 700-line SFC becomes a small composition shell plus focused composables; the public type barrel and generated contract are unchanged.
- Base: a small component remains in one file because splitting it would only add indirection.
- Bad: props are moved successfully, but Chinese JSDoc is rewritten in English, so a structure-only commit changes the generated API table.
- Bad: `defineExpose(exposeObject)` is moved to a helper and extraction starts including framework or inferred members.

### 6. Tests Required

- Run component behavior tests for every moved responsibility.
- Run component and workspace type checks, including the declaration/package consumer boundary.
- Re-run API extraction and compare section counts, member names, types, defaults, required flags, descriptions, and expanded type details against the pre-refactor contract.
- Add regression assertions for third-party component root classes or other DOM ownership constraints affected by the refactor.
- Build the documentation site and inspect one representative page in a browser at desktop and mobile widths.

### 7. Wrong vs Correct

#### Wrong

```ts
// useExample.ts
export const props = defineProps<ExampleProps>()

// A structure-only refactor also rewrites public docs.
export interface ExampleProps {
  /** Updated English description. */
  value?: string
}
```

#### Correct

```ts
// types/props.ts
export interface ExampleProps {
  /** 保留原有的公共说明。 */
  value?: string
}
```

```vue
<script setup lang="ts">
import type { ExampleProps } from './types'

const props = defineProps<ExampleProps>()
</script>
```

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
