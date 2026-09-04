# AI 文档助手结构治理技术设计

## 1. 稳定外部边界

保持以下数据流与入口不变：

```text
CLI / Vite Plugin -> ServerContext -> Discovery / Extraction / Index / Retrieval
UI -> /__ai-doc/api -> Router -> Query Handler -> UI Message Stream
@moluoxixi/ai-doc-assistant[/plugin|/protocol|/api-contract] -> 既有构建产物
```

`package.json` exports、bin、Vite library entry 名与 UI base `/__ai-doc/` 不调整。根 `index.ts` 继续显式导出原符号。

## 2. UI Ownership

```text
src/ui/
  main.ts
  App/
    index.vue
    components/
      index.ts
      WorkspaceTopbar/index.vue
      ChatView/
        index.vue
        components/{DemoPreview.vue,MarkdownContent.vue,index.ts}
        composables/{use-chat-workspace.ts,index.ts}
        services/{chat-turn-projection.ts,index.ts}
        types/index.ts
      DetailView/
        index.vue
        components/{TypeReference.vue,index.ts}
      OverviewView/index.vue
  preview/
    index.ts
    services/{compile.ts,index.ts}
```

`main.ts` 直接导入 `./App`。App 通过本地 components barrel 使用四个子组件；ChatView 继续直接动态导入自己的 `DemoPreview`，避免聚合 barrel 把 preview compiler 提前拉入主 chunk。

## 3. Core Domain

```text
src/core/
  index.ts
  discovery/services/component-discovery.ts
  extraction/services/{extractor,meta-extractor,type-source}.ts
  generation/services/generator.ts
  indexing/services/{index-state,indexer,persist}.ts
  knowledge/services/knowledge-source.ts
  retrieval/services/{retrieval-strategy,retriever}.ts
  vector/services/{vector-strategy,vector-store}.ts
  vector/adapters/{orama-store,qdrant-store}.ts
  vector/validation/embedding-validation.ts
  preview/services/{sfc-transpile,vue-block-extractor}.ts
  types/index.ts
```

每个 domain 及 responsibility 目录均有纯 `index.ts`。`core/index.ts` 保持原符号集合；其中 `splitAnswerSegments` 直接导出纯 answer-block 实现，避免 preview 聚合 barrel 把依赖 TypeScript 的 SFC 转译器带入 UI 主 chunk。Server 和测试优先使用对应 domain barrel，延迟加载实现与单元测试可使用精确责任路径；不保留旧根文件。

## 4. 依赖方向

- discovery/extraction/generation/indexing/knowledge 为基础 domain。
- retrieval 可依赖 indexing/knowledge 的 public barrel。
- vector 自有 store/result contracts 并依赖 indexing；legacy retriever 仅 type-import vector result，retrieval strategy 只通过 literal dynamic import 加载 vector，避免 value cycle。
- vector store adapters 位于 vector/adapters；Qdrant/Orama 的动态 import 与 provider 配置保持不变。
- preview 只处理 SFC/answer block 的纯转换，不依赖 UI component。
- UI 可使用 core 根/public domain barrel与 shared protocol；Core 不反向依赖 UI/server。

## 5. ChatView 状态拆分

`use-chat-workspace.ts` 迁移 transport、`useChat`、pending/abort、question submit/stop/clear、turn projection 与 focus expose；纯 message source/example/answer-block 投影归入 `services/chat-turn-projection.ts`。SFC 保留 props/emits、child component imports、图标与模板/CSS。composable 返回现有 refs/actions，不引入第二份 messages/question 状态。

## 6. Compatibility 与测试

- CLI characterization 通过 mock Vite/ServerContext 或 spawn build 产物，锁定两个 command、默认 host/port、options 透传、usage/error/exit。
- Core 文件移动先保持源码逐段等价；每个 domain 运行相关 unit，最后全包 test/typecheck/build。
- UI owner/Chat 拆分运行 app/chat/detail/demo/topbar tests与 Playwright desktop/mobile。
- `@moluoxixi/vitepress-theme-element-plus` 继续从 `./api-contract` 消费，需运行其 typecheck。
- architecture manifest 仅在 live diagnostic 消失后删除精确 debt，不新增 exception。

## 7. 回滚

按 characterization、UI owner、Core domain、ChatView 四个批次提交。任何 CLI/HTTP/stream/index/生成输出或 UI E2E 回归只回滚对应边界；旧私有路径不以 forwarding shim 恢复。
