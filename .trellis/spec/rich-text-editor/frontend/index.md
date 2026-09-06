# Rich Text Editor Frontend Guidelines

## Overview

These guidelines route changes in `rich-text-editor`'s frontend layer to the repository
contract and the package-specific contracts that contain real project rules.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [Public Entry](./public-entry.md) | Component, Vue plugin, styles, and packed source contract | Ready |

## Pre-Development Checklist

- Read [Repository Directory Structure](../../directory-structure.md) before creating or moving modules.
- Read [Public Entry](./public-entry.md) before changing component exports, installation, package files, or styles.
- Read each package-specific contract relevant to the files and behavior being changed.
- Run the validation commands required by those contracts.

## Implementation Boundaries

- `components/RichTextEditor/index.vue` is the composition shell. Keep TipTap
  lifecycle and content synchronization in `composables/use-rich-text-editor-controller.ts`.
- Keep default TipTap extension assembly in `services/editor-extensions.ts` so
  adding an extension does not require editing the shell's lifecycle code.
- Keep built-in toolbar and link panel rendering in their own components. The
  shell owns slot compatibility and passes state/actions into them.
- Do not fork TipTap or ProseMirror for product-level features; add local
  extensions or adapters first and preserve the package's existing HTML and
  public-entry contracts.
