# AI Doc Assistant Quality Contracts

## 1. Scope / Trigger

Apply this contract when changing `/query`, chat history, AI SDK UI Message Stream data parts, answer rendering, remote embedding, index persistence, browser E2E coverage, Core barrels, or package build/publish entries in `packages/ai-doc-assistant`. These paths cross server/UI, local/remote data, and source/build boundaries.

## 2. Signatures

```ts
type AiDocDataParts = {
  sources: SourceRef[]
  example: { blocks: ExampleBlock[] }
}

type AiDocUIMessage = UIMessage<never, AiDocDataParts>

prepareQuery(
  messages: AiDocUIMessage[],
  topK: number,
  strategy: RetrievalStrategy,
  signal?: AbortSignal,
): Promise<PreparedQuery>

createQueryUIMessageStream(
  prepared: PreparedQuery,
  deps: { model: LanguageModel | null },
  signal?: AbortSignal,
): ReadableStream<UIMessageChunk>

buildChatRequestMessages(
  messages: readonly AiDocUIMessage[],
  completedAssistantIds: ReadonlySet<string>,
): AiDocUIMessage[]

type QdrantMetadataPayload = {
  kind: 'ai-doc-index-metadata'
  schemaVersion: 1
  sourceHash: string
  embeddingIdentity: EmbeddingIdentity
}

// Required lazy implementation boundaries.
import('../../vector/services/vector-strategy')
import('../adapters/orama-store')
import('../adapters/qdrant-store')
```

Shared limits remain `MAX_HISTORY_MESSAGES = 20` and `MAX_HISTORY_CHARACTERS = 20_000`.
Playwright output remains below `packages/ai-doc-assistant/.playwright/`; published files remain `dist`, `index.ts`, and `src`.

## 3. Contracts

- Vue chat uses `@ai-sdk/vue` `useChat` with `DefaultChatTransport`. The browser sends validated `AiDocUIMessage[]`; private SSE framing and browser parsers are forbidden.
- `AiDocDataParts` remains a finite object type alias. AI SDK v7 rejects the equivalent `interface` as `UIDataTypes`; adding a string index signature satisfies the constraint but collapses `data-sources` / `data-example` payload discrimination to `unknown`.
- The server validates role order, text-only request history, counts, and character limits before converting UI messages to model messages. Browser data/tool parts never become prompt context.
- Retrieval and message conversion happen before response headers. Retrieval/config/index failures return structured JSON.
- Stream order is `data-sources` before text, then `data-example` after complete answer text, then one final `finish`.
- No retrieval match writes the fixed answer and never calls a chat model. Therefore chat may be unconfigured for that branch.
- Client disconnect aborts retrieval and `streamText`. Abort does not append an error chunk.
- Only completed assistant message IDs enter later history. Stopped/error turns retain visible partial text but are filtered from requests.
- Markdown disables raw HTML and rejects unsafe/protocol-relative URLs. Vue fenced blocks render through `DemoPreview` only once.
- Vector indexing uses SDK `embedMany` for documents and `embed` for questions. Component contract text is sent to the configured remote embedding Provider and may incur cost.
- `EmbeddingIdentity = { provider, model, endpointFingerprint, dimension }` persists with the index. Identity/source mismatches make it stale; restart hydrate must not re-embed a matching snapshot.
- Orama schemas and Qdrant collections use the returned vector dimension. Qdrant rebuild is delete-and-recreate; dimension drift never silently degrades to content mode.
- Qdrant persists `sourceHash` and the complete `EmbeddingIdentity` in a reserved metadata point inside the remote collection. Hydration must retrieve and validate that point; local snapshot/meta files are not sufficient evidence that a remote collection matches. Search must filter to `kind=document` so the metadata point cannot enter retrieval results.
- `NO_MATCH_SCORE_THRESHOLD` has one owner in `shared/protocol`; vector adapters must not import the legacy retriever for a duplicate constant or result DTO. `RetrievedChunk` belongs to the vector-store result contract.
- `core/index.ts` exports `splitAnswerSegments` from the browser-safe `vue-block-extractor` implementation. It must not route that export through a barrel that also exposes `sfc-transpile`, because that pulls the TypeScript runtime into the UI main chunk.
- `VectorStrategy`, `OramaVectorStore`, and `QdrantVectorStore` remain literal dynamic imports. Domain barrels must not turn those edges into eager value exports consumed by the default content path.
- Playwright reports and traces live under `.playwright/`, outside the publishable `dist`. CI artifact paths must follow the configured output paths.
- Every package `source` export must exist in the packed tarball. This package publishes `index.ts` and `src` alongside `dist`; browser test reports are never packed.

## 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Invalid role/order/parts or over limit | HTTP 400 `INVALID_REQUEST` |
| Retrieval or conversion fails before streaming | Structured JSON error |
| No chunks found | Sources + fixed answer + finish; zero model calls |
| Matched chunks but chat model missing | Sanitized provider-not-configured stream error |
| User aborts | Preserve partial text as stopped; no error chunk; exclude from history |
| Model fails after stream start | One sanitized UI stream error; raw cause stays server-side |
| Embedding target missing in vector mode | Explicit configuration failure |
| Embedding count/empty vector/dimension drift | Build/query failure; no partial ready state |
| Persisted identity or source hash differs | Index status `stale`; query blocked until rebuild |
| Qdrant metadata point is missing, malformed, or mismatched | Hydrate fails and the remote collection remains unavailable until rebuild |
| Model emits raw HTML or unsafe URL | Escape text; do not emit unsafe href |
| A Core barrel eagerly reaches `sfc-transpile` from the UI path | Reject the build shape; restore a browser-safe selective facade |
| Vector strategy/store implementation becomes a static import | Reject the change; retain literal dynamic imports and separate chunks |
| Playwright output resolves below `dist` | Move it to `.playwright/` and update CI artifact paths |
| Packed source condition target is missing | Include `index.ts` and `src` in `files`; fail packed-source verification |

## 5. Good / Base / Bad Cases

- Good: sources render first, answer streams, example blocks arrive after the full answer, and the turn becomes completed only at finish.
- Base: no completed turns sends only the current user message; no-match works without chat configuration.
- Good: restart hydrates a matching Orama/Qdrant index without remote embedding calls.
- Good: Qdrant hydrate verifies collection dimension plus its reserved metadata payload before marking the store ready.
- Bad: treating EOF or a later user message as proof that a failed/stopped turn completed corrupts future history.
- Bad: using a fixed embedding dimension or querying an old Qdrant collection after model change mixes incompatible vectors.
- Bad: accepting local `meta.json` as proof that a remote Qdrant collection has the same source/model can query vectors written by another deployment.
- Good: the UI build keeps `DemoPreview`, vector strategy, Orama, and Qdrant behind their intended lazy boundaries while the UI main chunk excludes TypeScript.
- Good: E2E diagnostics are uploaded from `.playwright/` and a pack dry-run contains `dist`, `index.ts`, and `src` without reports.
- Bad: replacing a selective Core facade with `export * from './preview'` makes browser code evaluate the SFC transpiler and bundle TypeScript.
- Bad: writing E2E reports below `dist` allows local test output to enter the next package tarball.

## 6. Tests Required

- Router tests cover request limits/order, pre-stream JSON failures, no-match without model, disconnect abort, and sanitized stream errors.
- UI message tests use AI SDK readers and assert sources < text < example < finish.
- Package type-check must compile both the `UIMessage<never, AiDocDataParts>` declaration and `ChatView` tag-based payload narrowing without casts.
- Chat tests cover submitted/streaming states, per-user done/stopped/error persistence, clear/unmount abort, partial text, and history filtering.
- Vector tests cover dynamic dimensions, count/empty-vector errors, abort, Orama/Qdrant mismatch, persistence, restart hydrate, and stale identity.
- Qdrant tests assert the reserved metadata point persists `schemaVersion`, `sourceHash`, and every embedding identity field; hydrate rejects missing/mismatched payloads, and search sends a `kind=document` filter.
- Markdown/Demo tests cover raw HTML, unsafe schemes, incomplete fences, allowlisted imports, and source-only fallback.
- Browser E2E uses an AI SDK compatible upstream stub and verifies desktop/mobile source, streamed text, demo mount, focus, and overflow behavior.
- Build, packed Node smoke, and browser-pack checks prove server Provider objects and secrets do not enter UI output.
- Build output inspection asserts `DemoPreview`, `vector-strategy`, `orama-store`, and `qdrant-store` remain separate chunks and that the UI main chunk does not absorb TypeScript through `sfc-transpile`.
- Package dry-run/packed smoke asserts `index.ts` and the `src` source targets exist while `.playwright`, `test-results`, and `playwright-report` are absent.
- Workflow tests assert CI uploads AI-doc diagnostics from the exact `.playwright/report` and `.playwright/test-results` paths and rejects the old `dist` paths.

## 7. Wrong vs Correct

### Wrong

```ts
const response = await fetch('/query')
for await (const frame of parsePrivateSse(response.body))
  reduceLegacyEvent(frame)
```

### Correct

```ts
const chat = useChat<AiDocUIMessage>({
  transport: new DefaultChatTransport({ api: '/__ai-doc/api/query' }),
})

const prepared = await prepareQuery(messages, topK, strategy, signal)
pipeUIMessageStreamToResponse({ response, stream: createQueryUIMessageStream(prepared, { model }, signal) })
```

### Qdrant Persistence

```ts
// Wrong: local metadata cannot prove which vectors currently live remotely.
await qdrant.hydrate(localSnapshot, localMetadata)

// Correct: retrieve the reserved point and compare sourceHash + every identity field.
const persisted = await retrieveMetadataPoint(collection)
assertMatchesPersistedMetadata(persisted, expectedMetadata)
```

### Lazy Facades And Test Output

```ts
// Wrong: UI consumers of core now traverse the TypeScript-backed transpiler.
export { splitAnswerSegments } from './preview'

// Correct: expose only the browser-safe leaf from the shared Core facade.
export { splitAnswerSegments } from './preview/services/vue-block-extractor'
```

```ts
// Wrong: test output sits inside the directory published by package.json.
outputDir: './dist/test-results'

// Correct: diagnostics stay outside dist and CI uploads this exact path.
outputDir: './.playwright/test-results'
```

## UI Regression Rules

- Keep `ChatView` mounted while switching to the knowledge workspace; it owns in-memory turns and the active request.
- Long contract tables scroll inside their section. The document and knowledge workspace must not gain horizontal overflow.
- Use explicit checking/loading/empty/error states. An empty array before completion is not an empty knowledge base.
- Command icons require accessible names and tooltips. View switches use tab semantics and keyboard navigation.
- Floating UI closes with Escape and click-outside and restores focus without stealing it from another selected control.
- `vue-component-meta` extraction E2E uses a source tree inside an existing TypeScript/Vue `tsconfig` program.
