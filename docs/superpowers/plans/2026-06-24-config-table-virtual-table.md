# ConfigTable Virtual Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ConfigTable`'s Element Plus table renderer with `ElTableV2` while preserving request caching, pagination, column slots, cell events, and downstream `PopoverTableSelect` behavior.

**Architecture:** Keep `ConfigTable` as the single public entry point, but remap its column contract onto TableV2 columns and renderers. Add explicit virtual-table sizing defaults so the component remains usable without forcing every caller to understand TableV2 internals. Update the popover wrapper and docs to match the new virtual-table contract.

**Tech Stack:** Vue 3.5, Element Plus TableV2, TanStack Vue Query, Vitest, Vue Test Utils.

---

## Task 1: Restore and keep request-option coverage

**Files:**
- Restore: `packages/components/src/RequestOptions/RequestOptions.test.ts`

- [x] **Step 1: Restore the deleted request-options test file**
- [x] **Step 2: Verify the test still covers `RequestSelectV2`, `RequestCascader`, and `RequestTreeSelect` request behavior**
- [x] **Step 3: Keep the file untouched unless a real regression appears**

## Task 2: Move `ConfigTable` to TableV2

**Files:**
- Modify: `packages/components/src/ConfigTable/src/types/index.ts`
- Modify: `packages/components/src/ConfigTable/src/index.vue`
- Modify: `packages/components/src/ConfigTable/ConfigTable.test.ts`

- [x] **Step 1: Redraw the public types around TableV2**
- [x] **Step 2: Map `columns` to `TableV2` columns and preserve header/cell slots**
- [x] **Step 3: Preserve request loading/error/loaded and pagination behavior**
- [x] **Step 4: Rework tests around `ElTableV2` stubs and TableV2 slot params**

## Task 3: Adapt `PopoverTableSelect`

**Files:**
- Modify: `packages/components/src/PopoverTableSelect/src/base/index.vue`
- Modify: `packages/components/src/PopoverTableSelect/PopoverTableSelect.test.ts`

- [x] **Step 1: Pass virtual-table sizing through the popover wrapper**
- [x] **Step 2: Update row highlight behavior to TableV2 row class hooks**
- [x] **Step 3: Refresh stubs and assertions in the popover tests**

## Task 4: Update docs and verify

**Files:**
- Modify: `docs/out-components/ConfigTable.md`
- Modify: `docs/out-components/PopoverTableSelect.md`
- Modify: `docs/components/ElementPlus.md`
- Modify: `docs/out-components/index.md` if the snapshot metadata needs a refresh

- [x] **Step 1: Describe the new TableV2 contract and required sizing props**
- [x] **Step 2: Re-run targeted tests and typecheck**
- [x] **Step 3: Summarize any remaining MISSING or risk items**
