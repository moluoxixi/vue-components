# AI Doc Assistant Quality Contracts

## 1. Scope / Trigger

Apply this contract when changing `/query`, chat history, AI SDK UI Message Stream data parts, answer rendering, remote embedding, index persistence, or browser E2E coverage in `packages/ai-doc-assistant`. These paths cross server/UI and local/remote data boundaries.

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
```

Shared limits remain `MAX_HISTORY_MESSAGES = 20` and `MAX_HISTORY_CHARACTERS = 20_000`.

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

## 5. Good / Base / Bad Cases

- Good: sources render first, answer streams, example blocks arrive after the full answer, and the turn becomes completed only at finish.
- Base: no completed turns sends only the current user message; no-match works without chat configuration.
- Good: restart hydrates a matching Orama/Qdrant index without remote embedding calls.
- Good: Qdrant hydrate verifies collection dimension plus its reserved metadata payload before marking the store ready.
- Bad: treating EOF or a later user message as proof that a failed/stopped turn completed corrupts future history.
- Bad: using a fixed embedding dimension or querying an old Qdrant collection after model change mixes incompatible vectors.
- Bad: accepting local `meta.json` as proof that a remote Qdrant collection has the same source/model can query vectors written by another deployment.

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

## UI Regression Rules

- Keep `ChatView` mounted while switching to the knowledge workspace; it owns in-memory turns and the active request.
- Long contract tables scroll inside their section. The document and knowledge workspace must not gain horizontal overflow.
- Use explicit checking/loading/empty/error states. An empty array before completion is not an empty knowledge base.
- Command icons require accessible names and tooltips. View switches use tab semantics and keyboard navigation.
- Floating UI closes with Escape and click-outside and restores focus without stealing it from another selected control.
- `vue-component-meta` extraction E2E uses a source tree inside an existing TypeScript/Vue `tsconfig` program.
