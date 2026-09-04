# VitePress Element Plus 主题结构治理技术设计

## 1. 稳定边界

保持 7 个 package exports、`dist/{index,markdown,node,repository,repository-node,repl,element-plus-docs}.js`、主题 CSS 和 CLI bin 不变。根 entry 文件继续是纯公共 barrel；`src/repl-entry.ts` 与 `src/repl/styles.css` 是现有公开 source target，不移动。

## 2. Content 与 Markdown

```text
content/demo/ElementPlusDocsDemo/
  index.vue
  components/{index.ts,ElementPlusDocsDemoSource.vue}

markdown/<feature>/
  index.ts
  services/<owner>.ts
```

DemoSource 只归属于 Demo。Markdown 的 demo fence、external playground、project plugin 和 source-link resolver 各自保留独立 service；稳定 ID 继续基于原始 fence，行号与 provider 输入不变。

## 3. Project 与 Routes

```text
project/{index.ts,services/config.ts,types/index.ts}
routes/{index.ts,services/routes.ts}
```

Project 归一化和 repository selection 保持纯 browser-safe config domain；Node Jiti/config discovery 留在 `node/project`。Routes 的旧公开函数继续从根导出，不做 semver 删除。

## 4. Repository

```text
content/repository/providers/
  index.ts
  adapters/{index.ts,gitee.ts,github.ts,gitlab.ts,local.ts,yunxiao.ts}
  services/{index.ts,registry.ts}

node/repository/
  index.ts
  adapters/{index.ts,api-client.ts,gitee.ts,github.ts,gitlab.ts,local.ts,yunxiao.ts}
  services/{index.ts,runtime.ts,sync.ts}
```

Browser providers 负责 snapshot validation/action projection；Node adapters 负责网络/git collectors。Runtime 保留按 provider 的动态 import，不改为 eager barrel import；provider-neutral synchronize/validate 进入 services。

## 5. Node Lifecycle

```text
node/content/{index.ts,services/content.ts}
node/playground/{index.ts,services/manifests.ts}
node/project/{index.ts,services/load-config.ts}
node/lifecycle/
  index.ts
  adapters/cli.ts
  services/{prepare.ts,runtime.ts}
```

`prepareElementPlusDocs` 保持 content → commands → playground → provider sync → validation 顺序；环境变量继续原地写入调用方对象。Lock 继续 compare-and-delete，content staging 不与单文件 atomic helper 合并。

## 6. Characterization 与分批

1. Public runtime keys、旧路径、barrel 和 Demo owner。
2. Markdown/Project/Routes。
3. Browser provider adapters/registry。
4. Node content/playground/lifecycle/project。
5. Node repository adapters/runtime/sync。

每批运行相关 unit/typecheck/architecture；最终运行全包 test、consumer、build/provenance、fixture、functional/visual E2E、packed Node/browser、lint 与 diff。

## 7. 回滚

各领域独立提交。任一 public key、Markdown provenance、repository snapshot、CLI lifecycle 或 browser/node isolation 回归时只回滚对应批次，不恢复旧路径 shim。
