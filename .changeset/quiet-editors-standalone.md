---
'@moluoxixi/components': minor
'@moluoxixi/config-form-headless': patch
---

Remove the `RichTextEditor` root export, subpath, auto-loader entry, and dependency. Import it from `@moluoxixi/rich-text-editor` instead.

Allow specifically typed fields with `readonlyRender` callbacks inside heterogeneous configured slot trees without weakening their model value type.
