# Directory Structure

> How frontend code is organized in this project.

---

## Overview

Documentation authoring sources and VitePress runtime content are separate. Authors edit committed locale directories. The supported `element-plus-docs` lifecycle rebuilds the ignored runtime tree before VitePress starts.

---

## Directory Layout

```text
docs/vitepress/
├─ zh/                              # committed Chinese authoring pages
├─ en/                              # committed English authoring pages
├─ public/                          # committed public asset sources
├─ .vitepress/                      # VitePress config and site integration
├─ scripts/                         # route/API generators
└─ .generated/
   ├─ content/{zh,en}/              # ignored VitePress srcDir
   │  ├─ components/*.md            # generated route shells
   │  └─ utils/*.md                 # generated route shells
   ├─ api/
   ├─ markdown/
   ├─ repository/
   └─ types/
```

---

## Module Organization

<!-- How should new features be organized? -->

- `zh/` and `en/` own human-authored homepage, guide, Playground, and overview pages.
- Component source documentation remains package-owned under `packages/**/docs/`; utility documentation remains in package README files.
- `.generated/content` is physical runtime input for VitePress/local search, not authoring source.
- `.vitepress/config.ts` and `.vitepress/theme/index.ts` remain under the VitePress site root even when `srcDir` points into `.generated`.

---

## Naming Conventions

<!-- File and folder naming rules -->

- Locale source directories use stable language directory names (`zh`, `en`).
- Generated route filenames use the catalog slug and are never committed.
- Runtime projections preserve source directory layout below `.generated/content`.

---

## Examples

<!-- Link to well-organized modules as examples -->

- Runtime staging implementation: `packages/vitepress-theme-element-plus/src/node/content.ts`.
- Project content configuration: `docs/vitepress/element-plus-docs.config.ts`.
- Component and utility generators: `docs/vitepress/scripts/generate-*-routes.mts`.
