# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Monaco Vue SFC Language Services

The workbench keeps the visible `src/App.vue` model on the `vue` language so template HTML, folding, and embedded
tokenization remain available. TypeScript semantics for `<script>` blocks use a hidden `typescript` mirror whose length and
line breaks exactly match the SFC; all non-script characters are replaced with spaces. This makes TypeScript worker offsets
safe to map directly back to the visible Vue model.

Required contracts:

- `MonacoEnvironment.getWorker(..., 'vue')` must return the bundled HTML worker because the custom Vue HTML language
  service creates its worker with the `vue` label.
- Vue script completion and Hover must query Monaco's TypeScript worker and the shared workbench declarations. A global
  mixed Vue/ConfigForm completion list is forbidden because it leaks exports across named-import modules.
- TypeScript Config semantic completion and Hover belong to Monaco's built-in TypeScript provider. The custom provider
  is limited to ConfigForm snippets and project-manifest module paths that have no ambient declaration; it must not
  duplicate worker exports or signatures.
- Module-path completion may use the explicit workbench module allowlist for Vue/Config fallback, plus package names from
  the current project manifest. Named-import completion must come from the declaration for the statement's actual module.
- Installing the workbench worker router must preserve an existing `MonacoEnvironment` and delegate unknown labels to its
  previous `getWorker`; TypeScript entries are de-duplicated before they are mapped to Monaco suggestions.
- If modular loading misses Monaco's one-shot TypeScript language event, initialize the pinned Monaco `tsMode` with
  `typescriptDefaults` before retrying `getTypeScriptWorker()`.
- Mirror content must update with the SFC model and be disposed with it.
- Every language used by an embedded SFC region must load its Monaco basic-language contribution explicitly;
  language-service workers provide diagnostics and semantic features but do not provide syntax tokenization.
- Vue SFC boundary rules must accept attributes on `<template>` as well as `<script>` and `<style>`, otherwise the
  template falls back to the outer plain-text tokenizer and loses HTML highlighting.

Regression coverage must assert worker routing for `vue`, exact mirror offsets/newlines, named-import module detection,
declaration isolation, manifest module merging, and real-browser completion/Hover for both Vue Source and TypeScript
Config models. Config checks must also prove that worker-provided exports and field properties are visible without duplicate
custom candidates.

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
