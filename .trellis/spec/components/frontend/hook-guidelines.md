# Hook Guidelines

> How hooks are used in this project.

---

## Overview

<!--
Document your project's hook conventions here.

Questions to answer:
- What custom hooks do you have?
- How do you handle data fetching?
- What are the naming conventions?
- How do you share stateful logic?
-->

(To be filled by the team)

---

## Custom Hook Patterns

<!-- How to create and structure custom hooks -->

(To be filled by the team)

---

## Data Fetching

<!-- How data fetching is handled (React Query, SWR, etc.) -->

(To be filled by the team)

---

## Naming Conventions

<!-- Hook naming rules (use*, etc.) -->

(To be filled by the team)

---

## Common Mistakes

<!-- Hook-related mistakes your team has made -->

(To be filled by the team)

---

## Delayed Global DOM Listeners

### Convention: Gate delayed installation by component lifecycle

**What**: A composable that installs a global listener after `nextTick` must re-check both the component lifecycle and the current feature condition when the callback runs. Cleanup of the global listener must not depend on whether listeners on a local element were installed.

**Why**: Closing, deactivating, or unmounting can happen before the queued callback. Synchronous cleanup cannot remove a listener that has not been installed yet, so an unchecked callback can install it after teardown.

**Contract**:

- Set the lifecycle gate before installing listeners in `onMounted` / `onActivated`.
- Clear the lifecycle gate before cleanup in `onDeactivated` / `onUnmounted`.
- Re-check the gate and the current visibility/enabled condition inside the delayed callback.
- Always clean up document/window listeners, even when local element listeners are already absent.
- When a watched target element changes, install on the replacement only while the lifecycle gate is active.

```ts
// Wrong: teardown cannot cancel this pending installation.
watch(visible, (value) => {
  if (value)
    nextTick(installDocumentListener)
})

// Correct: the callback observes the state at execution time.
let lifecycleActive = false

function scheduleDocumentListener(): void {
  nextTick(() => {
    if (lifecycleActive && visible.value)
      installDocumentListener()
  })
}

function deactivateListeners(): void {
  lifecycleActive = false
  removeDocumentListener()
  removeElementListeners()
}
```

**Required tests**:

- Close before the queued callback and assert that the global listener is never installed.
- Deactivate before the queued callback and assert that it remains uninstalled.
- Reactivate while the condition is true and assert exactly one installation.
- Unmount immediately after mounting and assert no listener remains after pending ticks flush.

**Example**: `packages/components/src/PopoverTableSelect/src/composables/use-popover-table-select-base.ts`.
