# Workbench Appearance Contract

## 1. Scope / Trigger

Apply this contract when changing Workbench color modes, palette families,
appearance persistence, first-paint bootstrap code, parent-document overlays,
or any UI that could accidentally pass Workbench styling into Design or
Preview Runtime iframes.

Appearance is an application preference. It is not project content and must
not enter `ProjectDocument`, History, Export, Recovery, or RuntimeHost payloads.

## 2. Signatures

```ts
type WorkbenchThemePreference = 'system' | 'light' | 'dark'
type WorkbenchResolvedTheme = 'light' | 'dark'
type WorkbenchPaletteFamily =
  | 'catppuccin'
  | 'kanagawa'
  | 'gruvbox'
  | 'rose-pine'

interface WorkbenchAppearancePreference {
  version: 1
  themePreference: WorkbenchThemePreference
  paletteFamily: WorkbenchPaletteFamily
}
```

The storage key is
`moluoxixi.config-form.workbench.appearance`. The DOM contract is
`data-theme="light|dark"` plus `data-palette="<family>"` on `html`, the active
Workbench or template root, and `#workbench-overlays`.

## 3. Contracts

- The default is `{ version: 1, themePreference: 'system', paletteFamily:
  'catppuccin' }`.
- The synchronous `index.html` bootstrap resolves the saved preference before
  the application module loads. Its key, version, defaults, and enums must stay
  aligned with the TypeScript parser through contract tests.
- `WorkbenchUiStore` is the only runtime owner. It persists preference changes,
  derives `resolvedTheme`, and synchronizes the parent document roots.
- Subscribe to `matchMedia('(prefers-color-scheme: dark)')` only while the
  preference is `system`; remove the listener when the preference becomes
  explicit or the watcher is disposed.
- Semantic `--wb-*` tokens own every palette. Element Plus `--el-*` variables
  are bridged only under Workbench, template, and overlay roots. Designer
  chrome receives only semantic bridge variables.
- `--wb-separator` is a quiet structural token for panel, header, row, and
  timeline separation. It must remain visibly distinct from adjacent surfaces
  while staying lower contrast than `--wb-control-border`; it is not a control
  boundary or focus indicator. Editable controls, segmented-control frames,
  popover/dialog/drawer outlines, and other interactive boundaries use
  `--wb-control-border`, while focus and error states keep their dedicated
  semantic tokens.
- Design and Preview Runtime iframes load provider-owned styling. Workbench
  appearance fields and styles never cross the RuntimeHost protocol boundary.
- Desktop uses the shared appearance panel in an `ElPopover`; mobile uses the
  same panel in an `ElDrawer`. Both append to `#workbench-overlays`, close with
  Escape, and restore focus to their trigger.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Exact version 1 object with known mode and palette | Accept and apply immediately |
| Missing, extra, malformed, or unknown field | Fall back to the complete default |
| Unknown version | Fall back; do not migrate or guess |
| `localStorage` read, parse, or write throws | Keep the in-memory default or current preference without throwing |
| `system` media query changes | Re-resolve and synchronize all parent-document roots |
| Explicit `light` or `dark` while the OS changes | Keep the explicit resolved theme |
| Overlay theme differs from the active root | Treat as a contract failure |
| Appearance field reaches project or Runtime serialization | Treat as an architecture failure |

## 5. Good / Base / Bad Cases

- Good: change `paletteFamily` in the UI store, persist the versioned preference,
  and synchronize `html`, Workbench/template, and overlay attributes.
- Base: no saved preference resolves from the current OS scheme with Catppuccin.
- Bad: store appearance in `ProjectDocument.settings`, add a RuntimeHost theme
  field, apply unscoped Element Plus variables to `:root`, or accept a partial
  saved object.

## 6. Tests Required

- Unit tests cover all explicit mode/palette combinations, both OS branches for
  `system`, exact-object rejection, invalid JSON, unknown enums/version, and
  blocked storage.
- Bootstrap tests execute the real inline script in an isolated VM context and
  assert valid and fail-closed results before Vue mounts.
- Store/component tests cover media-query listener cleanup, immediate
  persistence, shared Popover/Drawer selection, Escape, and trigger focus
  restoration.
- CSS tests cover every palette/resolved-theme token table. Text placed on
  `--wb-accent-soft` must use a foreground token whose contrast against that
  surface is explicitly tested; do not assume `--wb-muted` is valid there.
- CSS tests keep `--wb-control-border` and focus indicators at the required
  non-text contrast, and independently assert that `--wb-separator` is visible
  but quieter than the control boundary against both normal and raised
  surfaces. The standalone Designer default border contract remains unchanged;
  only the Workbench bridge may map structural designer chrome to the quieter
  separator.
- Browser Axe checks run after a Popover or Drawer entrance transition reaches
  its final visual state, so transient ancestor opacity is not mistaken for the
  settled color contract.
- E2E tests assert root/overlay synchronization, refresh restoration, project
  export exclusion, and unchanged Design/Preview computed-style fingerprints
  for both providers across all eight resolved palette states.
- Visual coverage uses eight desktop palette/scheme baselines plus four
  responsive/localization sentinels instead of duplicating `system` output.

## 7. Wrong vs Correct

Wrong:

```ts
project.settings.theme = paletteFamily
runtimeHost.postMessage({ theme: resolvedTheme })
```

Correct:

```ts
writeWorkbenchAppearancePreference({
  version: 1,
  themePreference,
  paletteFamily,
})
document.documentElement.dataset.theme = resolvedTheme
document.documentElement.dataset.palette = paletteFamily
```
