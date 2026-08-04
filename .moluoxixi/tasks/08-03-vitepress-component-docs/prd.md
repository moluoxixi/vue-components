# VitePress component documentation

## Goal

Deliver a production-ready component-library documentation site whose navigation, component pages, examples, API tables, and visual language closely match the Element Plus documentation experience.

## Background

- The repository already contains an uncommitted VitePress site and 11 component documentation pages. These changes must be preserved and completed rather than replaced wholesale.
- `packages/ai-doc-assistant` extracts 13 public Vue component contracts from `packages/components/index.ts`.
- Documentation coverage follows the public component entry: every public Vue component must have a route and generated API documentation, even when a handwritten demo is not yet available.

## Requirements

- R1: Use a custom VitePress theme with an information-dense, restrained visual treatment highly similar to Element Plus documentation.
- R2: Make the overview the main route and first screen. It must provide direct access to all 13 public components.
- R3: Generate props, emits, expose, and slots API data from `packages/ai-doc-assistant`; do not maintain those contracts by hand in Markdown.
- R4: Author and maintain component explanations and runnable example code manually. API rendering must remain independent from example availability; components without a demo still receive a complete API page.
- R5: Show complete or expanded type information in an accessible tooltip that works with pointer, keyboard, and touch interaction.
- R6: Preserve local search, sidebar navigation, previous/next links, dark mode, responsive layout, and code-copy/source-toggle interactions.
- R7: Correct known documentation/runtime defects: missing assets, non-running dayjs demo, wrong ConfigTable response contract/defaults, wrong PopoverTableSelect prop values, API extraction false-green behavior, and mobile overflow.
- R8: Verify the built site in a real browser, including the overview, representative component pages, dynamic demos, tooltips, desktop/mobile layouts, and console errors.

## Acceptance Criteria

- [x] `/` is the overview and visibly lists all 13 public components above a usable continuation of the page.
- [x] Theme, navigation, sidebar, demo blocks, API tables, typography, spacing, and colors form a coherent Element Plus-like documentation experience on desktop and mobile.
- [x] `pnpm --filter @moluoxixi/docs extract-api` uses `packages/ai-doc-assistant`, writes deterministic contract data, and exits non-zero when required components cannot be extracted.
- [x] Every component page consumes generated API data for props, emits, expose, and slots, with empty sections omitted.
- [x] Long/custom types have discoverable details via hover/focus/tap tooltip behavior.
- [x] All 13 public components have generated API pages; the existing 11 demo-bearing pages continue to render without compilation errors.
- [x] Static assets render without 404s and component demos remain scrollable/usable at narrow widths.
- [x] Relevant tests/type checks pass, VitePress production build succeeds, and browser smoke checks show no blocking console/page errors.

## Out Of Scope

- Publishing or deploying the site.
- Documenting standalone ConfigForm adapter packages that are not exported by `@moluoxixi/components`.
- Reworking `packages/ai-doc-assistant` features beyond what is required to consume its existing public contract output.
- Changing component runtime APIs to make documentation easier.
