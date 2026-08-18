# Quality Guidelines

> Code quality standards for the reusable Element Plus-style VitePress theme.

---

## Overview

The theme exposes playground destinations as ordered, repository-neutral actions. A consuming documentation site configures supported destinations, while repository hosts own source, edit, issue, and line-link URLs through a separate provider contract.

---

## Forbidden Patterns

- Do not construct GitHub, GitLab, or other repository URLs in a playground adapter.
- Do not let a repository metadata provider open CodeSandbox, StackBlitz, the self-hosted Vue Playground, or the lightweight playground.
- Do not render playground buttons from a second hard-coded order outside the canonical kind contract.
- Do not silently accept duplicate action kinds or an adapter whose action kind differs from its declared kind.
- Do not remove the legacy Demo callback props without a separate compatibility change.

---

## Required Patterns

## Scenario: Repository-neutral playground adapter registry

### 1. Scope / Trigger

- Trigger: adding, removing, reordering, or changing a Demo playground destination; changing the content integration that creates playground actions; or changing repository source navigation adjacent to the Demo toolbar.
- Scope: theme playground types and adapters, the playground registry, the reusable Demo component, the content integration, and consumer-supplied repository source links.

### 2. Signatures

The canonical kind list defines both the public union and configured action order:

```ts
const elementPlusDocsPlaygroundKinds = [
  'codesandbox',
  'stackblitz',
  'element-plus',
  'lightweight',
] as const

type ElementPlusDocsPlaygroundKind
  = typeof elementPlusDocsPlaygroundKinds[number]
```

Every destination adapts to one action contract:

```ts
interface ElementPlusDocsPlaygroundActionContext {
  demoId: string
  projectSource?: ElementPlusDocsExternalProjectSource
  source: string
}

interface ElementPlusDocsPlaygroundAction {
  kind: ElementPlusDocsPlaygroundKind
  open(context: ElementPlusDocsPlaygroundActionContext): void | Promise<void>
}

interface ElementPlusDocsPlaygroundAdapter {
  kind: ElementPlusDocsPlaygroundKind
  createAction(): ElementPlusDocsPlaygroundAction
}

interface ElementPlusDocsPlaygroundRegistry {
  actions: readonly ElementPlusDocsPlaygroundAction[]
  get(kind: ElementPlusDocsPlaygroundKind): ElementPlusDocsPlaygroundAction | undefined
}
```

The registry and configured factory remain public theme APIs:

```ts
function createElementPlusDocsPlaygroundRegistry(
  adapters: readonly (ElementPlusDocsPlaygroundAdapter | undefined)[],
): ElementPlusDocsPlaygroundRegistry

function createElementPlusDocsPlaygroundActions(
  config: Pick<ElementPlusDocsPlaygroundConfig, 'elementPlus' | 'external' | 'path'>,
  runtime: ElementPlusDocsPlaygroundActionRuntime,
): readonly ElementPlusDocsPlaygroundAction[]
```

### 3. Contracts

- `elementPlusDocsPlaygroundKinds` is the single configured order for built-in actions and the Demo toolbar.
- A missing optional provider is omitted; the relative order of remaining adapters is preserved.
- The lightweight playground is always created when `path` and its runtime are supplied.
- Each adapter creates exactly one action with the same `kind` as the adapter.
- Registry actions are frozen and indexed by kind; `get(kind)` returns the same action object present in `actions`.
- Demo passes the currently selected TS or JS source, the stable Demo ID, and optional build-time external project source to the selected action.
- A Demo-level `playgroundActions` value takes precedence over legacy callback props. The callbacks remain a compatibility path for consumers not yet using the registry.
- Repository source links arrive at Demo as normalized `sourceHref` values. Their provider identity, branch, file path, and line URL construction remain outside the theme playground layer.
- Adding a repository host changes only the repository provider registry. Adding a playground destination changes only the playground kind, adapter, configured mapping, messages/icons, and tests.
- No environment key is required by the registry. Individual external destinations may use browser navigation or form submission, but they must receive all project data through the action context and adapter configuration.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Two adapters create the same action kind | Throw `Duplicate playground action kind.` before returning a registry |
| Adapter kind and created action kind differ | Throw an error naming both kinds |
| Optional adapter is `undefined` | Omit it without changing remaining order |
| Config omits CodeSandbox, StackBlitz, or the self-hosted Vue Playground | Do not create or invoke that destination runtime |
| Demo requests a kind absent from its action index | Do not render or dispatch that action |
| Repository provider does not support source links | Omit the Demo source link; do not fall back to a hard-coded host |
| Action receives generated JS as the selected source | Open that action with JS while leaving other Demo blocks' selections unchanged |

### 5. Good/Base/Bad Cases

- Good: configure all four destinations, produce actions in canonical order, and let the selected repository provider independently supply a GitHub line link.
- Base: configure only the lightweight path; render one lightweight action and no external destination buttons.
- Bad: make a `github` metadata provider return CodeSandbox callbacks, or let Demo infer a GitHub `/blob/` URL from repository fields.

### 6. Tests Required

- Unit-test canonical order with every built-in destination enabled.
- Unit-test omission of unconfigured destinations without invoking their runtimes.
- Unit-test duplicate kinds, adapter/action kind mismatch, frozen actions, stable `get()` identity, and preservation of relative order around `undefined` adapters.
- Unit-test each adapter with the selected source and optional external project source.
- Component-test Demo action order, localized accessible names, current-Demo-only TS/JS switching, unified-action precedence, and legacy callback compatibility.
- Consumer-test repository source links separately for supported and unsupported repository-provider capabilities.
- Browser-test desktop and mobile toolbar layout, the mobile page outline, both documentation locales, and absence of page-level horizontal overflow.

### 7. Wrong vs Correct

#### Wrong

```ts
if (metadataProvider === 'github') {
  actions.push({ kind: 'codesandbox', open: source => openSandbox(source) })
  sourceHref = `${repositoryUrl}/blob/${branch}/${path}`
}
```

This couples an editor destination and a repository host, so a new source platform cannot reuse the same playground actions.

#### Correct

```ts
const playgroundActions = createElementPlusDocsPlaygroundActions(
  playgroundConfig,
  playgroundRuntime,
)

const sourceHref = repositoryProvider.capabilities.sourceLinks
  ? repositoryProvider.actions?.sourceLineHref(sourceLocation)
  : undefined
```

The playground registry owns editor destinations; the selected repository provider independently owns source navigation.

---

## Testing Requirements

Playground contract changes require focused adapter/registry tests, Demo component tests, theme type checking, theme production build provenance verification, and at least one consuming documentation browser check across desktop and mobile.

---

## Code Review Checklist

- Does one canonical kind list still control built-in action order?
- Are adapter/action kinds validated and unique?
- Are unconfigured destinations omitted without side effects?
- Does Demo dispatch the selected source only for the active block?
- Are legacy callbacks still compatible unless intentionally versioned away?
- Are repository URLs absent from playground adapters and playground URLs absent from repository providers?
- Are source links capability-gated and consumer-owned?
- Do focused tests, type checking, build verification, and responsive browser checks pass?
