# Implementation Plan

1. [x] Correct the Playground baseline to a 24-cell grid and add regression coverage for explicit 12-cell container spans.
2. [x] Add responsive breakpoint types, schema parsing, compiler passthrough, designer breakpoint controls, and runtime CSS-variable resolution.
3. [x] Add normalized option-source types and adapter resolver hooks; update Element Plus static/default option flows and state UI.
4. [x] Add designer-local mock model state, pure condition evaluation, and visual linkage preview controls.
5. [x] Add default/rule diagnostic projection and export validation without document mutation.
6. [x] Run scoped unit tests, typechecks, builds, desktop/narrow E2E, then perform cross-layer review.

## Validation Commands

- `pnpm --filter @moluoxixi/config-form-designer test -- --run`
- `pnpm --filter @moluoxixi/config-form-designer typecheck`
- `pnpm --filter @moluoxixi/config-form-designer-element-plus test -- --run`
- `pnpm --filter @moluoxixi/config-form-designer-element-plus typecheck`
- `pnpm --filter @config-form/playground typecheck`
- `pnpm --filter @config-form/playground build`
- `CONFIG_FORM_PLAYGROUND_PORT=4331 pnpm --filter @config-form/playground test:e2e -- --grep "designer|designer entry"`

## Final Validation

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm --filter @moluoxixi/config-form test:coverage` (95.88% functions, 95.75% statements)
- [x] `pnpm build`
- [x] `pnpm --filter @config-form/playground build`
- [x] Standalone Designer Playwright suite (3 passed at desktop and narrow viewports)
- [x] Cross-layer review of document, compiler, Designer, Element Plus adapter, and Runtime boundaries

## Risk Gates

- Do not change numeric document semantics while adding responsive presets.
- Do not let core designer code fetch remote options.
- Add round-trip tests before changing compiler/runtime public types.
