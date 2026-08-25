# ConfigForm Architecture Documentation

## Convention: Keep the architecture README current

`packages/ConfigForm/README.md` is the current-state architecture source of truth for the ConfigForm package family.

Update it in the same change set when a task changes any of these contracts:

- package ownership, package names, public subpaths, dependencies, or peer dependencies;
- the Headless/Renderer path or the Runtime/Plugin path;
- DesignerDocument, Headless node, reaction, slot, option source, or extension metadata;
- material/component registries, naming rules, error codes, discovery, or precedence;
- a capability reused by two or more ConfigForm packages.

Task `design.md` records implementation history and trade-offs. Package README files document package APIs. Neither is a substitute for updating the current architecture facts in `packages/ConfigForm/README.md`.

Before finishing a cross-package ConfigForm task, verify:

1. The dependency diagram still matches package manifests.
2. Package responsibilities and data flows match the implementation.
3. Extension selection and override precedence remain accurate.
4. New terminology distinguishes Runtime plugins, Designer adapters, lightweight UI packages, and Vue plugins.
5. `pnpm test:config-form-packages` covers any new public package boundary.
