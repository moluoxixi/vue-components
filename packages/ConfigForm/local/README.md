# ConfigForm 本地工作区与 MCP

本地服务托管设计器与文件工作区。浏览器和 AI 工具通过同一服务编辑项目，并交付普通 Vue 源码。模型由 MCP 客户端提供，本工具不要求另一套模型密钥。

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

已实现官方 MCP SDK 的 stdio transport，提供 13 个工具：

| 工具                              | 用途                                 |
| --------------------------------- | ------------------------------------ |
| `list_projects` / `get_project`   | 读取项目、配置与保存版本             |
| `list_materials` / `get_material` | 查找组件、属性、slot、交互与默认节点 |
| `list_templates`                  | 查询 preset 的内置模板               |
| `create_node` / `create_project`  | 使用合法默认值创建节点或项目         |
| `apply_operations`                | 原子修改节点、布局、浮层、数据与交互 |
| `validate_project`                | 校验配置、编译、资源和源码生成能力   |
| `preview_surface`                 | 获取保存版本的交互预览链接           |
| `generate_source`                 | 生成不可变源码产物和文件清单         |
| `read_source_file`                | 读取产物中的一个文件                 |
| `export_source`                   | 下载 ZIP 或写入工作区内的新目录      |

建议顺序：查询物料/模板 → 创建项目 → 读取 revision → 原子编辑 → 校验/预览 → 生成源码 → 读取文件审核 → 导出。保存与生成要求 `expectedRepositoryRevision`；冲突时重新读取用户的新版本。网络重试可使用同一个 `commandId` 和相同 payload。

`.configform/workspace.json` 保存原子发布的事务日志，包含项目、历史、提交回执与图片内容，复用 Model Repository 的校验、CAS、标签和幂等规则。工作区只允许一个写入服务；其他进程通过 HTTP/MCP 接入。写入失败恢复上一保存状态，重启通过日志恢复。

产物保存在 `.configform/artifacts/<hash>.json`，绑定 projectId、revision 和文件内容。导出到 `generated/<name>/` 或 ZIP 时使用同一产物，后续界面编辑不会改变已有产物。预览读取保留的项目版本；页面可以操作，弹窗/抽屉通过入口按钮打开，缺少示例值的必填参数使用 null。

文件输出检查路径越界、重复名称、符号链接和目录覆盖。API 只监听 `127.0.0.1`，校验 Host/Origin；变更请求要求专用请求头。

本轮完成第一个可用闭环。个人模板库仍在浏览器；日志尚未物理压缩，长历史会增加磁盘占用和重启时间。首版不包含远程多人协作、MCP 截图、自然语言模型托管、业务后端生成或手改 Vue 的无损回导。下一步集中在源码差异审核、公共模板工作区和日志快照压缩。新包尚未发布到 npm。

验证命令：

```sh
pnpm -C packages/ConfigForm/local test
pnpm -C packages/ConfigForm/local test:e2e
pnpm -C packages/ConfigForm/local verify:source
pnpm -C packages/ConfigForm/local verify:pack
```

`verify:source` 需先构建 Local 和依赖。它用真实 MCP 客户端创建两套员工目录，导出到仓库外的临时目录，全新安装依赖并执行类型检查、构建与浏览器交互。检查在职筛选、点击行打开表单、必填校验、关闭、图片与手机布局，输出工程路径、截图和验证记录。业务数据写回与后端连接由开发者在交付源码中实现。

`verify:pack` 同样需要先构建。它将 SDK 与依赖打包，在仓库外全新安装，以 NodeNext 和完整声明检查验证公共入口，再运行源码生成、HTTP 读写、MCP、已安装 CLI 与随包设计器。它不会发布 npm 包。
