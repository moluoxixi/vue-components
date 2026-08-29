# Quality Guidelines

> Code quality standards for frontend development.

## Overview

External playground adapters are platform boundaries. Keep the shared Vue/Vite
project as the StackBlitz source of truth, and let each provider create only the
files and request fields required by that provider.

## Forbidden Patterns

- Do not submit `environment=server` for an anonymous CodeSandbox Define request.
  It creates a Devbox and returns `Anonymous users are not allowed to create devboxes`.
- Do not put CodeSandbox-only task files in the shared external project. They
  would leak into StackBlitz and future providers.
- Do not treat a local payload round-trip test as proof that a provider can run
  the project. Provider environment selection and preview startup need explicit
  contract assertions and, when possible, an anonymous smoke check.

## Required Patterns

### External Playground Provider Contract

#### 1. Scope / Trigger

- Trigger: any change to the external playground request, generated files, or
  provider environment selection.
- Boundary: documentation demo source -> normalized project -> provider payload
  and form request.

#### 2. Signatures

- `createElementPlusDocsExternalProject(source, options, projectSource)` creates
  the shared Vite/Vue project consumed by StackBlitz.
- `createElementPlusDocsCodeSandboxPayload(project)` creates a provider-specific
  anonymous Browser Sandbox payload.
- `openElementPlusDocsCodeSandbox(project, options)` submits the Define API form.
- `openElementPlusDocsStackBlitz(project, options)` submits the StackBlitz node
  project form.

#### 3. Contracts

Shared project contract:

- `package.json` contains `start: "vite --host 0.0.0.0"`.
- `vite.config.ts`, `src/main.ts`, and `src/App.vue` are present.
- StackBlitz receives the shared files unchanged and uses `startScript=start`.

Anonymous CodeSandbox contract:

- Endpoint: `POST https://codesandbox.io/api/v1/sandboxes/define`.
- Form fields: compressed `parameters`; do not submit `environment=server`.
- Decoded files contain `sandbox.config.json` with `{ "template": "vue-cli" }`.
- The Vite-only `vite.config.ts` and `src/main.ts` files are removed.
- `src/main.ts` is copied to `src/main.js`.
- `package.json.main` points to `src/main.js`, while `index.html` contains only
  the Vue mount node and no Vite module script.
- Vite and `@vitejs/plugin-vue` are removed from `devDependencies`, and the
  Vite `scripts` object is removed so CodeSandbox does not infer a Node/Devbox
  project.
- TypeScript demos add `typescript` to `devDependencies`; JavaScript demos do
  not receive the compiler dependency.

#### 4. Validation & Error Matrix

| Condition | Expected behavior |
| --- | --- |
| Anonymous CodeSandbox request with `environment=server` | Reject with `Anonymous users are not allowed to create devboxes` |
| Anonymous CodeSandbox payload with Vite dependency | May infer Node/Devbox and fail to start without authentication |
| Anonymous CodeSandbox payload with `template=vue-cli` | Creates a Browser Sandbox without a server port |
| Browser Sandbox `index.html` keeps the Vite module script | Entry request can fail with an HTML MIME response |
| CodeSandbox Vue transpiler worker/CDN is unavailable | Report as a third-party runtime failure after payload creation succeeds |
| StackBlitz project | Retains Vite files and `startScript=start` |
| Payload encoding/decoding | Decoded files equal the provider-specific payload |

#### 5. Good / Base / Bad Cases

- Good: CodeSandbox sends only compressed files, forces `vue-cli`, and keeps
  StackBlitz on the shared Vite project.
- Base: A demo source has no extra dependencies or style imports.
- Bad: CodeSandbox receives the shared Vite project plus
  `.codesandbox/tasks.json` and `environment=server` for an anonymous user.

#### 6. Tests Required

- Assert the shared project still contains Vite files and only the `start` script.
- Assert StackBlitz receives the shared project unchanged and submits
  `startScript=start`.
- Assert CodeSandbox removes Vite-only files and adds `sandbox.config.json` with
  `template=vue-cli`.
- Assert `package.json.main`, the script-free mount HTML, and conditional
  TypeScript dependency generation.
- Assert CodeSandbox form fields do not include `environment` and include the
  compressed `parameters` field.
- Decode the compressed payload and assert its complete file set and package
  metadata.
- Run an anonymous provider smoke check when the external service is available;
  classify provider worker/network failures separately from application errors.

#### 7. Wrong vs Correct

Wrong:

```typescript
submitElementPlusDocsProjectForm(action, {
  environment: 'server',
  parameters: createElementPlusDocsCodeSandboxParameters(project),
})
```

Correct:

```typescript
const payload = createElementPlusDocsCodeSandboxPayload(project)
submitElementPlusDocsProjectForm(action, {
  parameters: compress(payload),
})
```

The CodeSandbox payload must force the anonymous `vue-cli` template and must not
request a Devbox. The shared Vite project remains the StackBlitz contract.

## Testing Requirements

- Provider adapters require focused unit tests for form fields and decoded files.
- Changes to external provider contracts require a real provider smoke check when
  authentication and service availability permit it.
- Report third-party runtime or worker failures separately from repository test
  failures.

## Code Review Checklist

- [ ] Is the provider-specific transformation isolated from the shared project?
- [ ] Does the request avoid anonymous-incompatible Devbox fields?
- [ ] Are template inference triggers explicit and tested?
- [ ] Are StackBlitz files and startup behavior unchanged?
- [ ] Does the test cover both the serialized payload and form fields?
