# Shared AI Provider Contracts

## 1. Scope / Trigger

Apply this contract when changing `@moluoxixi/ai-provider`, adding an AI consumer, or changing Provider/model configuration. The package owns validated Vercel AI SDK model construction and secret-free status projection. It does not own generation, streaming, embedding orchestration, retries, or product environment variables.

## 2. Signatures

```ts
type LanguageModelTarget =
  | { provider: 'openai', apiKey: string, model: string }
  | { provider: 'anthropic', apiKey: string, model: string }
  | { provider: 'google', apiKey: string, model: string }
  | { provider: 'openai-compatible', apiKey: string, baseURL: string, model: string }

type EmbeddingModelTarget =
  | { provider: 'openai', apiKey: string, model: string }
  | { provider: 'google', apiKey: string, model: string }
  | { provider: 'openai-compatible', apiKey: string, baseURL: string, model: string }

createLanguageModel(target: LanguageModelTarget): LanguageModel
createEmbeddingModel(target: EmbeddingModelTarget): EmbeddingModel
aiRuntimeStatusOf(config: {
  chat: LanguageModelTarget | null
  embedding: EmbeddingModelTarget | null
}): AiRuntimeStatus
```

Package entries:

```text
@moluoxixi/ai-provider         browser-safe types, IDs, status DTOs, stable errors
@moluoxixi/ai-provider/shared  browser-safe types, IDs, status DTOs, stable errors
@moluoxixi/ai-provider/server  secret-bearing targets, model factories, causes, redaction
```

Internal responsibilities:

```text
src/shared/{types,constants,validation,errors}  browser-safe contracts and runtime guards
src/server/types                                secret-bearing target unions
src/server/adapters                             Vercel AI SDK model construction
src/server/services                             runtime status and diagnostic cause ownership
src/server/utils                                pure secret redaction
```

## 3. Contracts

- Consumers own environment variable names and map them to independent chat and embedding targets. Shared code never reads `AI_DOC_*`, `I18N_TOOL_*`, or product defaults.
- Provider selection and model names are explicit. Never infer Provider from a model name.
- Chat supports OpenAI, Anthropic, Google, and OpenAI-compatible. Embedding supports OpenAI, Google, and OpenAI-compatible; Anthropic is not an embedding branch.
- OpenAI-compatible targets require an absolute HTTP(S) `baseURL` without credentials, query, or fragment. Other providers do not accept a custom endpoint.
- Factories return SDK-native `LanguageModel` / `EmbeddingModel`. Consumers call `streamText`, `generateText`, `embed`, or `embedMany` directly from `ai`.
- API keys and target objects stay under `./server`. `AiRuntimeStatus` exposes only availability, provider, and model.
- `src/shared/index.ts` and `src/server/index.ts` are pure barrels. Shared never imports server; server adapters depend on target types, shared contracts, and services without a reverse value edge.
- The root and `./shared` runtime symbol sets are exactly equivalent. The `./server` runtime set is explicit; accidental new exports are API changes and must fail entry tests.
- The package must not reintroduce fetch wrappers, `/chat/completions`, `/embeddings`, model SSE parsing, `streamChat`, or a private embedding function.
- `ai` and Provider adapters are runtime dependencies and remain external in the library build.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Empty API key or model | `AiProviderError('INVALID_PROVIDER_CONFIG')` |
| Unknown Provider at runtime | `INVALID_PROVIDER_CONFIG`; no fallback |
| Compatible target missing/invalid `baseURL` | `INVALID_PROVIDER_CONFIG` |
| Credentials/query/fragment in `baseURL` | `INVALID_PROVIDER_CONFIG` |
| Anthropic requested for embedding | Rejected by the embedding target type; no fake adapter branch |
| Missing product capability config | Consumer stores `null`; status is `missing` |
| Configured target | Status contains provider/model only; never key or endpoint |
| Root/shared exports a server factory, target, cause, status factory, or redaction helper | Entry-boundary failure; keep it under `./server` |
| A feature/responsibility `index.ts` gains implementation logic | Architecture failure; move logic to its owning directory |

## 5. Good / Base / Bad Cases

- Good: ai-doc maps explicit chat and embedding env groups to separate targets and builds both SDK models.
- Base: chat is configured while embedding is `null`; content search and chat remain available, vector indexing is unavailable.
- Bad: selecting a Provider from the model prefix makes config behavior ambiguous and prevents reliable migrations.
- Bad: wrapping `streamText` or `embedMany` in a repository transport recreates the removed protocol and error surface.
- Good: target unions live in server `types`, model construction in `adapters`, status/cause in `services`, and redaction in `utils`.
- Bad: putting SDK imports or target validation back into a shared barrel leaks server concerns into browser consumers.

## 6. Tests Required

- Factory tests cover all four chat branches and all three embedding branches, including provider/model IDs.
- Validation tests cover blank keys/models, invalid compatible URLs, credentials, and unknown runtime providers.
- Status tests assert configured/missing projections and prove serialized output contains no secret.
- Entry tests assert exact root/shared and server runtime symbol sets; root/shared do not expose targets, factories, status factories, causes, redaction, or removed transport APIs.
- Build, packed Node smoke, and packed browser smoke assert adapter resolution and server-only isolation.
- Browser bundle scanning rejects `createLanguageModel`, `createEmbeddingModel`, `getAiProviderErrorCause`, and `apiKey`.

## 7. Wrong vs Correct

### Wrong

```ts
const answer = streamChat(config, messages, signal)
const vectors = embed(config, inputs, signal)
```

### Correct

```ts
const model = createLanguageModel(target)
const result = streamText({ model, messages, abortSignal: signal })

const embeddingModel = createEmbeddingModel(embeddingTarget)
const result = await embedMany({ model: embeddingModel, values: inputs, abortSignal: signal })
```

### Entry Ownership

```ts
// Wrong: implementation lives in a feature barrel and pulls SDK code into shared consumers.
// src/shared/index.ts
export function createLanguageModel(target: LanguageModelTarget) { /* ... */ }

// Correct: the shared barrel only aggregates browser-safe responsibilities.
// src/shared/index.ts
export * from './constants'
export * from './errors'
export type * from './types'
export * from './validation'
```
