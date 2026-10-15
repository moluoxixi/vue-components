# ConfigForm Studio SDK

供浏览器、Node、CLI 和 MCP 共用的配置创作与源码生成工具。生产入口不加载设计器、Vue 组件、样式、DOM 或 IndexedDB。

```ts
import { createStudioProject, generateProjectSource } from '@moluoxixi/config-form-studio'

const project = createStudioProject({
  id: 'account-app',
  name: '用户资料',
  preset: 'element-plus',
  templateId: 'element-profile',
})
const result = await generateProjectSource({ project, preset: 'element-plus', styleTarget: 'tailwind-v4' })
if (!result.success) {
  throw new Error(JSON.stringify(result.diagnostics))
}

console.log(result.data.entry, result.data.files)
```

`generateProjectSource` 接受当前 ProjectDocument、完整项目 transfer 或它们的 JSON 文本，返回确定的文本/二进制文件集与结构化诊断。原生 Vue 工程不依赖 ConfigForm，可继续修改源码。裸文档的嵌入图片需要 `resourceReader`；完整 transfer 自带图片内容。

内置 `element-plus` 和 `antd-vue`，也可注入 Source 的 `{ registry, componentResolver }` 自定义 preset。`surfaceId` 导出指定页面及其浮层、数据和资源依赖。底层入口见 [Source](../source/README.md)。

`getStudioCatalog(preset)` 返回组件 contract、属性、默认节点和模板；`createStudioNode` 返回可用于 Model `node.insert` 的默认子树。字段传 `field`，对象组与数组组也用 `field` 指定值域名称，布局的子节点通过事务插入指定 slot。`createStudioProject` 自动设置当前物料锁，调用方不需要猜测 fingerprint。

目录从现有 Designer 声明和 Workbench 源码映射生成。修改物料后执行 `pnpm -C packages/ConfigForm/workbench generate:catalogs` 并提交 JSON；工作台测试比较实际声明和 SDK 目录，检测遗漏。

`@moluoxixi/config-form-studio/client` 单独提供 `openHttpProjectRepository`，实现完整 ProjectRepository 合同，并提供变化与连接状态订阅；这个子入口不包含物料目录或生成器。

```ts
import { openHttpProjectRepository } from '@moluoxixi/config-form-studio/client'

const repository = await openHttpProjectRepository({ url: 'http://127.0.0.1:4332' })
console.log(await repository.list())
repository.close()
```

配套文件工作区、CLI、设计器和 MCP 见 [Local](../local/README.md)。当前处于研发阶段，新包尚未发布到 npm。
