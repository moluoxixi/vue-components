# ConfigForm 本地工作区与 MCP

本地服务托管设计器、AI 对话和文件工作区。浏览器对话与 MCP 使用同一份实时预览草稿，确认后保存为项目，继续可视化编辑或导出普通 Vue 源码。MCP 使用客户端已有的模型；设计器内对话可选配置自己的模型服务。

在仓库中构建并启动：

```sh
pnpm --filter @moluoxixi/config-form-local... build
node packages/ConfigForm/local/dist/cli.js serve --workspace ./ui-workspace --port 4332
```

打开 `http://127.0.0.1:4332/#/projects`。发行物包含构建后的设计器，用户无需另行运行 Vite。顶部显示工作区名称；Chrome 与内置浏览器打开同一服务即可看到同一批项目。

浏览器独立模式继续使用当前浏览器存储。启动本地服务不会搬走旧项目，可用现有“导出项目 / 导入项目”进入工作区。连接失败时提示并保留连接，不自动切换仓库。

开发时添加 `--allow-origin http://127.0.0.1:4331`，再打开 `http://127.0.0.1:4331/?workspace=http://127.0.0.1:4332#/projects`，即可让 Vite 设计器使用本地工作区。默认只允许同源客户端和回环地址。

不启动服务也能生成源码：

```sh
node packages/ConfigForm/local/dist/cli.js generate ./project.json --out ./account-app --style tailwind-v4
```

CLI 从物料锁推断 preset，或显式指定 `--preset element-plus` / `--preset antd-vue`。完整 transfer 支持图片；裸文档通过 SDK 提供 reader 或改用完整 transfer。`--surface <id>` 导出单页面依赖。输出目录必须不存在，保护已经编辑的源码。

MCP 客户端配置示例（CLI 路径改为本机的绝对路径）：

```json
{
  "mcpServers": {
    "config-form": {
      "command": "node",
      "args": [
        "D:/project-new/vue-component/packages/ConfigForm/local/dist/cli.js",
        "mcp",
        "--url",
        "http://127.0.0.1:4332"
      ]
    }
  }
}
```

已实现官方 MCP SDK 的 stdio transport，提供 17 个工具：

| 工具                                     | 用途                                 |
| ---------------------------------------- | ------------------------------------ |
| `list_projects` / `get_project`          | 读取项目、配置与保存版本             |
| `list_materials` / `get_material`        | 查找组件、属性、slot、交互与默认节点 |
| `list_templates`                         | 查询 preset 的内置模板               |
| `create_node` / `create_project`         | 使用合法默认值创建节点或项目         |
| `apply_operations`                       | 原子修改节点、布局、浮层、数据与交互 |
| `validate_project`                       | 校验配置、编译、资源和源码生成能力   |
| `preview_surface`                        | 获取保存版本的交互预览链接           |
| `open_live_preview` / `get_live_preview` | 创建或读取实时预览草稿和打开链接     |
| `apply_preview_operations`               | 原子更新草稿，自动刷新已打开的界面   |
| `save_live_preview`                      | 将预览保存到项目，检查原项目版本冲突 |
| `generate_source`                        | 生成不可变源码产物和文件清单         |
| `read_source_file`                       | 读取产物中的一个文件                 |
| `export_source`                          | 下载 ZIP 或写入工作区内的新目录      |

建议顺序：查询物料/模板 → 创建项目 → 读取 revision → 原子编辑 → 校验/预览 → 生成源码 → 读取文件审核 → 导出。保存与生成要求 `expectedRepositoryRevision`；冲突时重新读取用户的新版本。网络重试可使用同一个 `commandId` 和相同 payload。

## 对话与实时预览

从项目列表选择「AI 生成」，或在已有项目的页面/数据管理中选择「AI 修改」。桌面同时显示对话与表单，手机通过「对话 / 实时预览」切换。每批成功修改都会重新渲染真实表单，可操作字段、撤销、继续提要求，再保存到项目。

模型请求直接使用 [Vercel AI SDK](https://ai-sdk.dev/docs/introduction) 与官方 provider；仓库不再提供 `@moluoxixi/ai-provider` 封装包。密钥只在本地服务中使用，不下发到浏览器或写入项目 JSON。启动前配置以下环境变量：

```sh
export CONFIG_FORM_AI_API_FORMAT=openai-chat-completions
export CONFIG_FORM_AI_MODEL=your-model-id
export CONFIG_FORM_AI_API_KEY=your-key
# 可选：兼容网关的 API 根路径，应包含该网关要求的 /v1 等前缀
export CONFIG_FORM_AI_BASE_URL=https://your-gateway.example/v1
node packages/ConfigForm/local/dist/cli.js serve --workspace ./ui-workspace --port 4332
```

| `CONFIG_FORM_AI_API_FORMAT` | SDK 入口                          | 请求格式                                    |
| --------------------------- | --------------------------------- | ------------------------------------------- |
| `openai-responses`          | `@ai-sdk/openai` · `.responses()` | OpenAI Responses                            |
| `openai-chat-completions`   | `@ai-sdk/openai` · `.chat()`      | OpenAI Chat Completions，含使用该协议的网关 |
| `anthropic-messages`        | `@ai-sdk/anthropic`               | Anthropic Messages                          |
| `gemini`                    | `@ai-sdk/google`                  | Gemini GenerateContent                      |

服务地址可选，省略时使用 SDK 的官方地址。协议和模型必须显式指定；所选模型或网关需要支持工具调用。配置变更后重启服务。不配置模型仍可使用项目设计器和全部 MCP 工具。

在 MCP 客户端中可这样提出需求：

> 创建一个请假申请表，调用 open_live_preview，并用你的浏览器工具打开返回的 previewUrl。每添加一批字段调用 apply_preview_operations，让我边看预览边调整，最后确认保存。

`open_live_preview` 返回 `sessionId` 和 `previewUrl`。AI 打开该链接后，后续修改同一个 session，无需重新打开页面。使用 `expectedSessionRevision` 防止覆盖其他修改；保存已有项目还会核对初始 `expectedRepositoryRevision`。MCP 客户端需要具备打开浏览器的能力；普通浏览器链接也可手动打开，不依赖客户端支持内嵌 MCP Apps。

草稿和聊天记录只保留在运行中的本地服务内存中，保存项目才会写入文件；关闭服务会结束所有草稿。最多同时打开 32 个会话，每会话可提交 1000 批修改并撤销最近 50 批。界面「结束会话」释放会话，未保存时会提示。停止生成保留已完成的修改，不会撤销已保存的项目。保存冲突会保留草稿和原项目，需检查最新项目后重新编辑。

`.configform/workspace.json` 保存原子发布的事务日志，包含项目、历史、提交回执与图片内容，复用 Model Repository 的校验、CAS、标签和幂等规则。工作区只允许一个写入服务；其他进程通过 HTTP/MCP 接入。写入失败恢复上一保存状态，重启通过日志恢复。

产物保存在 `.configform/artifacts/<hash>.json`，绑定 projectId、revision 和文件内容。导出到 `generated/<name>/` 或 ZIP 时使用同一产物，后续界面编辑不会改变已有产物。预览读取保留的项目版本；页面可以操作，弹窗/抽屉通过入口按钮打开，缺少示例值的必填参数使用 null。

文件输出检查路径越界、重复名称、符号链接和目录覆盖。API 只监听 `127.0.0.1`，校验 Host/Origin；变更请求要求专用请求头。

个人模板库保存在浏览器，可从模板库备份、导入 JSON；文件工作区的项目与个人模板库分开存储。日志尚未物理压缩，长历史会增加磁盘占用和重启时间。不包含远程多人协作、MCP 截图、业务后端生成或手改 Vue 的无损回导。新包尚未发布到 npm。

验证命令：

```sh
pnpm -C packages/ConfigForm/local test
pnpm -C packages/ConfigForm/local test:e2e
pnpm -C packages/ConfigForm/local verify:source
pnpm -C packages/ConfigForm/local verify:pack
```

`verify:source` 需先构建 Local 和依赖。它用真实 MCP 客户端创建两套员工目录，导出到仓库外的临时目录，全新安装依赖并执行类型检查、构建与浏览器交互。检查在职筛选、点击行打开表单、必填校验、关闭、图片与手机布局，输出工程路径、截图和验证记录。业务数据写回与后端连接由开发者在交付源码中实现。

`verify:pack` 同样需要先构建。它将 SDK 与依赖打包，在仓库外全新安装，以 NodeNext 和完整声明检查验证公共入口，再运行源码生成、HTTP 读写、MCP、已安装 CLI 与随包设计器。它不会发布 npm 包。
